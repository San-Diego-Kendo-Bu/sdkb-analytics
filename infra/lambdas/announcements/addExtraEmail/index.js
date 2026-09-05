const { query } = require("../../shared_utils/db");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const parameters = JSON.parse(event.body || "{}");
        const email = (parameters.email ?? "").trim().toLowerCase();
        const label = parameters.label?.trim() || null;

        if (!EMAIL_REGEX.test(email)) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Please enter a valid email address." }),
            };
        }

        const result = await query(
            `
            INSERT INTO extra_broadcast_emails (email, label)
            VALUES ($1, $2)
            ON CONFLICT (email) DO UPDATE SET label = EXCLUDED.label
            RETURNING email, label, created_at
            `,
            [email, label]
        );

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Added", data: result.rows[0] }),
        };
    } catch (err) {
        console.error("addExtraEmail error:", err);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message }),
        };
    }
};
