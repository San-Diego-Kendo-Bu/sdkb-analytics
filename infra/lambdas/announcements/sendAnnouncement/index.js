const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { getAllMembers } = require("../../shared_utils/members");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");
const { query } = require("../../shared_utils/db");
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

function getFilenameFromUrl(url) {
    try {
        const segment = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "attachment");
        const dashIdx = segment.indexOf("-");
        return dashIdx >= 0 ? segment.slice(dashIdx + 1) : segment;
    } catch {
        return "attachment";
    }
}

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const { subject, body, attachment_urls, pdf_url } = JSON.parse(event.body || "{}");

        if (!subject || !body) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "subject and body are required" }),
            };
        }

        // Accept new attachment_urls array or fall back to legacy pdf_url
        const urls = Array.isArray(attachment_urls) && attachment_urls.length
            ? attachment_urls
            : pdf_url ? [pdf_url] : [];

        const { user: gmailUser, pass: gmailPass } = await getGmailCredentials();

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: gmailUser, pass: gmailPass },
        });

        const members = await getAllMembers();
        const emails = [...new Set(members.map((m) => m.email).filter(Boolean))];

        const attachments = (
            await Promise.all(
                urls.map(async (url) => {
                    try {
                        const resp = await fetch(url);
                        if (!resp.ok) return null;
                        const contentType = resp.headers.get("content-type") ?? "application/octet-stream";
                        const content = Buffer.from(await resp.arrayBuffer());
                        return { filename: getFilenameFromUrl(url), content, contentType };
                    } catch {
                        return null;
                    }
                })
            )
        ).filter(Boolean);

        const escapedBody = body
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br>");

        const htmlBody = `<p>${escapedBody}</p>`;
        const textBody = body;

        let sent = 0;
        let failed = 0;
        const failures = [];

        const BATCH_SIZE = 10;
        for (let i = 0; i < emails.length; i += BATCH_SIZE) {
            const batch = emails.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
                batch.map(email => transporter.sendMail({
                    from: `SDKB Portal <${gmailUser}>`,
                    to: email,
                    subject,
                    html: htmlBody,
                    text: textBody,
                    attachments,
                }))
            );
            results.forEach((r, idx) => {
                if (r.status === "fulfilled") {
                    sent++;
                } else {
                    console.error(`Failed to send to ${batch[idx]}:`, r.reason?.message);
                    failures.push(batch[idx]);
                    failed++;
                }
            });
        }

        // Store as JSON array in pdf_url column; old plain-string rows remain readable
        const dbPdfUrl = urls.length > 0 ? JSON.stringify(urls) : null;

        await query(
            `INSERT INTO announcements (announcement_id, subject, body, pdf_url, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [Date.now(), subject, body, dbPdfUrl]
        );

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
