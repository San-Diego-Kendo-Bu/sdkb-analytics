const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { getAllMembers } = require("../../shared_utils/members");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");
const nodemailer = require("nodemailer");

const REGION = process.env.AWS_REGION;
const GMAIL_SECRET_ID = process.env.GMAIL_SECRET_ID;

const secrets = new SecretsManagerClient({ region: REGION });

async function getGmailCredentials() {
    const r = await secrets.send(new GetSecretValueCommand({ SecretId: GMAIL_SECRET_ID }));
    const raw = r.SecretString ?? Buffer.from(r.SecretBinary || "", "base64").toString("utf8");
    const obj = JSON.parse(raw);
    return { user: obj.GMAIL_USER, pass: obj.GMAIL_APP_PASSWORD };
}

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const { subject, body, pdf_url } = JSON.parse(event.body || "{}");

        if (!subject || !body) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "subject and body are required" }),
            };
        }

        const { user: gmailUser, pass: gmailPass } = await getGmailCredentials();

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: gmailUser, pass: gmailPass },
        });

        const members = await getAllMembers();
        const emails = [...new Set(members.map((m) => m.email).filter(Boolean))];

        let pdfBuffer = null;
        if (pdf_url) {
            const resp = await fetch(pdf_url);
            if (resp.ok) pdfBuffer = Buffer.from(await resp.arrayBuffer());
        }

        const escapedBody = body
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br>");

        const htmlBody = `<p>${escapedBody}</p>`;
        const textBody = body;

        const attachments = pdfBuffer
            ? [{ filename: "newsletter.pdf", content: pdfBuffer, contentType: "application/pdf" }]
            : [];

        let sent = 0;
        let failed = 0;
        const failures = [];

        for (const email of emails) {
            try {
                await transporter.sendMail({
                    from: `SDKB Portal <${gmailUser}>`,
                    to: email,
                    subject,
                    html: htmlBody,
                    text: textBody,
                    attachments,
                });
                sent++;
            } catch (err) {
                console.error(`Failed to send to ${email}:`, err.message);
                failures.push(email);
                failed++;
            }
        }

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                message: `Sent to ${sent} member${sent !== 1 ? "s" : ""}, ${failed} failed`,
                sent,
                failed,
                failures,
            }),
        };
    } catch (err) {
        console.error("sendAnnouncement error:", err);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message }),
        };
    }
};
