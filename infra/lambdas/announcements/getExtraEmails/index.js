const { query } = require("../../shared_utils/db");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const result = await query(
            `SELECT email, label, created_at FROM extra_broadcast_emails ORDER BY created_at DESC`
        );

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ data: result.rows }),
        };
    } catch (err) {
        console.error("getExtraEmails error:", err);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message }),
        };
    }
};
