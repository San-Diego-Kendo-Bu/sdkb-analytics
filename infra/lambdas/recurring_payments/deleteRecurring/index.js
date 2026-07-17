const { query } = require("../../shared_utils/db");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");

const H = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};
    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const { payment_id } = JSON.parse(event.body || "{}");
        if (!payment_id) {
            return { statusCode: 400, headers: H, body: JSON.stringify({ error: "payment_id is required" }) };
        }

        const result = await query(
            `UPDATE recurring_payments SET is_active = false WHERE payment_id = $1`,
            [payment_id]
        );
        if (result.rowCount === 0) {
            return { statusCode: 404, headers: H, body: JSON.stringify({ error: "Not found" }) };
        }

        return { statusCode: 200, headers: H, body: JSON.stringify({ message: "Recurring payment cancelled" }) };
    } catch (err) {
        console.error("deleteRecurring error:", err);
        return { statusCode: 500, headers: H, body: JSON.stringify({ error: err.message }) };
    }
};
