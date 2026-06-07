const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");

const REGION = process.env.AWS_REGION;
const BUCKET_NAME = process.env.NEWSLETTER_BUCKET_NAME;

const s3 = new S3Client({ region: REGION });

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const rawFilename = event.queryStringParameters?.filename ?? `newsletter-${Date.now()}.pdf`;
        const safeFilename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `newsletters/${Date.now()}-${safeFilename}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: "application/pdf",
        });

        const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
        const pdfUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`;

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({ upload_url: uploadUrl, pdf_url: pdfUrl }),
        };
    } catch (err) {
        console.error("getUploadUrl error:", err);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message }),
        };
    }
};
