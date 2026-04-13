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
        const parameters = JSON.parse(event.body || "{}");
        const paymentId = parseInt(parameters.payment_id, 10);

        if (Number.isNaN(paymentId)) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Please specify a valid payment id" })
            };
        }

        const paymentExists = await query(
            `
            SELECT 1
            FROM "payments"
            WHERE payment_id = $1
            `,
            [paymentId]
        );

        if (paymentExists.rowCount === 0) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Could not remove payment: ID not found" })
            };
        }

        await query(
            `
            DELETE FROM "submitted_payments"
            WHERE payment_id = $1
            `,
            [paymentId]
        );

        await query(
            `
            DELETE FROM "assigned_payments"
            WHERE payment_id = $1
            `,
            [paymentId]
        );

        const result = await query(
            `
            DELETE FROM "payments"
            WHERE payment_id = $1
            RETURNING *
            `,
            [paymentId]
        );

        const data = result.rows[0];

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Payment removed successfully",
                data
            })
        };

    } catch (err) {
        console.error("removePayment error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};