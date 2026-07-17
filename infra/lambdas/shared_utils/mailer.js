const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const nodemailer = require("nodemailer");

const REGION = process.env.AWS_REGION;
const GMAIL_SECRET_ID = process.env.GMAIL_SECRET_ID;

const secretsClient = new SecretsManagerClient({ region: REGION });

async function getGmailCredentials() {
    const r = await secretsClient.send(new GetSecretValueCommand({ SecretId: GMAIL_SECRET_ID }));
    const raw = r.SecretString ?? Buffer.from(r.SecretBinary || "", "base64").toString("utf8");
    const obj = JSON.parse(raw);
    return { user: obj.GMAIL_USER, pass: obj.GMAIL_APP_PASSWORD };
}

async function sendEmails(emails, subject, html, text) {
    if (!emails || emails.length === 0) return;
    const { user: gmailUser, pass: gmailPass } = await getGmailCredentials();
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
    });
    const BATCH_SIZE = 10;
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
        const batch = emails.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
            batch.map(email => transporter.sendMail({
                from: `SDKB Portal <${gmailUser}>`,
                to: email,
                subject,
                html,
                text,
            }))
        );
    }
}

module.exports = { sendEmails };
