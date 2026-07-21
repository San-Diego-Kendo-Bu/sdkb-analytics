const {
    SecretsManagerClient,
    GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

const { getAllMembers } = require("../../shared_utils/members");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");
const { query } = require("../../shared_utils/db");
const nodemailer = require("nodemailer");

const REGION = process.env.AWS_REGION;
const GMAIL_SECRET_ID = process.env.GMAIL_SECRET_ID;

const secrets = new SecretsManagerClient({ region: REGION });

async function getGmailCredentials() {
    const response = await secrets.send(
        new GetSecretValueCommand({
            SecretId: GMAIL_SECRET_ID,
        })
    );

    const raw =
        response.SecretString ??
        Buffer.from(response.SecretBinary || "", "base64").toString("utf8");

    const credentials = JSON.parse(raw);

    return {
        user: credentials.GMAIL_USER,
        pass: credentials.GMAIL_APP_PASSWORD,
    };
}

function getFilenameFromUrl(url) {
    try {
        const segment = decodeURIComponent(
            new URL(url).pathname.split("/").pop() ?? "attachment"
        );

        const dashIndex = segment.indexOf("-");

        return dashIndex >= 0
            ? segment.slice(dashIndex + 1)
            : segment;
    } catch {
        return "attachment";
    }
}

/**
 * Converts internal Nodemailer/Gmail errors into short,
 * user-friendly messages that are safe to show in the UI.
 */
function getSafeEmailError(errorMessage = "") {
    const message = errorMessage.toLowerCase();

    if (
        message.includes("invalid recipient") ||
        message.includes("recipient address rejected") ||
        message.includes("mailbox unavailable") ||
        message.includes("address not found") ||
        message.includes("no such user") ||
        message.includes("user unknown")
    ) {
        return "Recipient address was rejected.";
    }

    if (
        message.includes("quota") ||
        message.includes("rate limit") ||
        message.includes("too many") ||
        message.includes("sending limit")
    ) {
        return "Email sending limit was reached.";
    }

    if (
        message.includes("timeout") ||
        message.includes("timed out") ||
        message.includes("connection") ||
        message.includes("econnreset") ||
        message.includes("econnrefused")
    ) {
        return "Could not connect to the email service.";
    }

    if (
        message.includes("authentication") ||
        message.includes("invalid login") ||
        message.includes("username and password not accepted")
    ) {
        return "The email service could not authenticate.";
    }

    if (
        message.includes("spam") ||
        message.includes("blocked") ||
        message.includes("message rejected")
    ) {
        return "The email provider rejected the message.";
    }

    return "Email could not be delivered.";
}

/**
 * Logs elapsed execution time and remaining Lambda time.
 */
function logTiming(context, startedAt, stage, details = {}) {
    const remainingMs =
        typeof context?.getRemainingTimeInMillis === "function"
            ? context.getRemainingTimeInMillis()
            : null;

    console.log("Announcement timing", {
        requestId: context?.awsRequestId,
        stage,
        elapsedMs: Date.now() - startedAt,
        remainingMs,
        ...details,
    });
}

exports.handler = async (event, context) => {
    const handlerStartedAt = Date.now();

    logTiming(context, handlerStartedAt, "handler_started");

    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ??
        {};

    const groups = normalizeGroups(claims["cognito:groups"]);

    const isAdmin = groups.some(
        (group) =>
            group === "admins" ||
            group.endsWith(" admins")
    );

    if (!isAdmin) {
        logTiming(context, handlerStartedAt, "authorization_failed");

        return {
            statusCode: 403,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                error: "Forbidden",
            }),
        };
    }

    try {
        const {
            subject,
            body,
            attachment_urls,
            pdf_url,
            target,
        } = JSON.parse(event.body || "{}");

        logTiming(context, handlerStartedAt, "request_parsed", {
            target,
            attachmentCount: Array.isArray(attachment_urls)
                ? attachment_urls.length
                : pdf_url
                    ? 1
                    : 0,
        });

        if (!subject || !body) {
            logTiming(context, handlerStartedAt, "validation_failed", {
                hasSubject: Boolean(subject),
                hasBody: Boolean(body),
            });

            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                body: JSON.stringify({
                    error: "Subject and body are required.",
                }),
            };
        }

        // Accept the new attachment_urls array or fall back
        // to the legacy pdf_url field.
        const urls =
            Array.isArray(attachment_urls) &&
                attachment_urls.length > 0
                ? attachment_urls
                : pdf_url
                    ? [pdf_url]
                    : [];

        const {
            user: gmailUser,
            pass: gmailPass,
        } = await getGmailCredentials();

        logTiming(context, handlerStartedAt, "gmail_credentials_loaded");

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: gmailUser,
                pass: gmailPass,
            },
        });

        const membersStartedAt = Date.now();
        const members = await getAllMembers();

        logTiming(context, handlerStartedAt, "members_loaded", {
            memberLookupDurationMs: Date.now() - membersStartedAt,
            memberCount: members.length,
        });

        const isSensei = (member) =>
            member.rank_type === "shihan" ||
            (
                member.rank_type === "dan" &&
                Number(member.rank_number) >= 4
            );

        const eligible = members.filter((member) => {
            if (member.status === "inactive") {
                return false;
            }

            if (target === "senseis") {
                return isSensei(member);
            }

            return true;
        });

        const emails = [
            ...new Set(
                eligible
                    .map((member) => member.email)
                    .filter(Boolean)
            ),
        ];

        logTiming(context, handlerStartedAt, "recipients_prepared", {
            target: target === "senseis" ? "senseis" : "all",
            totalMembers: members.length,
            eligibleMembers: eligible.length,
            recipientCount: emails.length,
        });

        logTiming(context, handlerStartedAt, "attachment_download_started", {
            requestedAttachmentCount: urls.length,
        });

        const attachmentStartedAt = Date.now();

        const attachments = (
            await Promise.all(
                urls.map(async (url) => {
                    try {
                        const response = await fetch(url);

                        if (!response.ok) {
                            console.error("Attachment download failed", {
                                requestId: context?.awsRequestId,
                                url,
                                status: response.status,
                                statusText: response.statusText,
                            });

                            return null;
                        }

                        const contentType =
                            response.headers.get("content-type") ??
                            "application/octet-stream";

                        const content = Buffer.from(
                            await response.arrayBuffer()
                        );

                        return {
                            filename: getFilenameFromUrl(url),
                            content,
                            contentType,
                        };
                    } catch (error) {
                        console.error("Attachment download failed", {
                            requestId: context?.awsRequestId,
                            url,
                            message: error?.message,
                            code: error?.code,
                        });

                        return null;
                    }
                })
            )
        ).filter(Boolean);

        logTiming(context, handlerStartedAt, "attachment_download_completed", {
            attachmentDurationMs: Date.now() - attachmentStartedAt,
            requestedAttachmentCount: urls.length,
            downloadedAttachmentCount: attachments.length,
            failedAttachmentCount: urls.length - attachments.length,
        });

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
        const sendStartedAt = Date.now();

        logTiming(context, handlerStartedAt, "email_sending_started", {
            recipientCount: emails.length,
        });

        if (emails.length > 0) {
            try {
                const info = await transporter.sendMail({
                    from: `SDKB Portal <${gmailUser}>`,

                    // Visible recipient.
                    to: gmailUser,

                    // Filtered recipients are hidden from one another.
                    bcc: emails,

                    subject,
                    html: htmlBody,
                    text: textBody,
                    attachments,
                });

                const rejected = Array.isArray(info.rejected)
                    ? info.rejected
                    : [];

                failed = rejected.length;
                sent = emails.length - failed;

                console.log("Announcement email sent", {
                    requestId: context?.awsRequestId,
                    messageId: info.messageId,
                    accepted: info.accepted,
                    rejected,
                });

                rejected.forEach((email) => {
                    failures.push({
                        email,
                        reason: "Recipient address was rejected.",
                    });
                });
            } catch (error) {
                const rawError =
                    error?.message ||
                    "Unknown delivery error";

                console.error("Announcement send failed", {
                    requestId: context?.awsRequestId,
                    message: rawError,
                    code: error?.code,
                    responseCode: error?.responseCode,
                    response: error?.response,
                    command: error?.command,
                });

                failed = emails.length;

                emails.forEach((email) => {
                    failures.push({
                        email,
                        reason: getSafeEmailError(rawError),
                    });
                });
            }
        }

        logTiming(context, handlerStartedAt, "email_sending_completed", {
            sendingDurationMs: Date.now() - sendStartedAt,
            recipientCount: emails.length,
            sent,
            failed,
        });

        // Store attachment URLs as a JSON array.
        // Existing plain-string rows remain readable.
        const dbPdfUrl =
            urls.length > 0
                ? JSON.stringify(urls)
                : null;

        const dbTarget =
            target === "senseis"
                ? "senseis"
                : "all";

        const databaseStartedAt = Date.now();

        logTiming(context, handlerStartedAt, "database_insert_started", {
            sent,
            failed,
        });

        await query(
            `INSERT INTO announcements (
                announcement_id,
                subject,
                body,
                pdf_url,
                target,
                created_at
            )
            VALUES ($1, $2, $3, $4, $5, NOW())`,
            [
                Date.now(),
                subject,
                body,
                dbPdfUrl,
                dbTarget,
            ]
        );

        logTiming(context, handlerStartedAt, "database_insert_completed", {
            databaseDurationMs: Date.now() - databaseStartedAt,
        });

        logTiming(context, handlerStartedAt, "response_returning", {
            totalDurationMs: Date.now() - handlerStartedAt,
            recipientCount: emails.length,
            sent,
            failed,
        });

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                message:
                    failed > 0
                        ? `${sent} sent, ${failed} failed`
                        : `Sent to ${sent} member${sent !== 1 ? "s" : ""}`,
                sent,
                failed,
                failures,
            }),
        };
    } catch (error) {
        console.error("sendAnnouncement error", {
            requestId: context?.awsRequestId,
            elapsedMs: Date.now() - handlerStartedAt,
            remainingMs:
                typeof context?.getRemainingTimeInMillis === "function"
                    ? context.getRemainingTimeInMillis()
                    : null,
            message: error?.message,
            code: error?.code,
            name: error?.name,
            stack: error?.stack,
        });

        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                error:
                    error?.message ||
                    "The announcement could not be sent.",
            }),
        };
    }
};