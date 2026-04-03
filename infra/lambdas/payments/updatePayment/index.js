const { query } = require("../../shared_utils/db");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");

const FIELDS = [
    "payment_id",
    "title",
    "created_at",
    "due_date",
    "payment_value",
    "overdue_penalty"
];

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

        const payload = {};
        for (const field of FIELDS) {
            payload[field] = field in parameters ? parameters[field] : null;
        }

        if (
            payload.payment_value !== null &&
            payload.payment_value !== undefined &&
            parseFloat(payload.payment_value) < 1.0
        ) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: "Please update payment to at least $1.00.",
                    payment_value: payload.payment_value
                })
            };
        }

        if (
            payload.overdue_penalty !== null &&
            payload.overdue_penalty !== undefined &&
            parseFloat(payload.overdue_penalty) < 0.0
        ) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: "Please update overdue value to at least $0.00.",
                    overdue_penalty: payload.overdue_penalty
                })
            };
        }

        const paymentCheck = await query(
            `
            SELECT has_submission
            FROM payments
            WHERE payment_id = $1
            `,
            [paymentId]
        );

        if (paymentCheck.rowCount === 0) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Payment not found" })
            };
        }

        const hasSub = paymentCheck.rows[0].has_submission;
        if (hasSub) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    error: "Could not update payment: a submission has already been made to this payment."
                })
            };
        }

        const result = await query(
            `
            UPDATE payments
            SET
                title = COALESCE($1, title),
                created_at = COALESCE($2, created_at),
                due_date = COALESCE($3, due_date),
                payment_value = COALESCE($4, payment_value),
                overdue_penalty = COALESCE($5, overdue_penalty)
            WHERE payment_id = $6
            RETURNING *
            `,
            [
                payload.title,
                payload.created_at,
                payload.due_date,
                payload.payment_value,
                payload.overdue_penalty,
                paymentId
            ]
        );

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Payment updated successfully",
                data: result.rows[0]
            })
        };

    } catch (err) {
        console.error("updatePayment error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};