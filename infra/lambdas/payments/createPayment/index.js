const { getCurrentTimeUTC } = require("../../shared_utils/dates");
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

        const title = parameters.title;
        const createdAt = parameters.created_at || getCurrentTimeUTC();
        const dueDate = parameters.due_date || null;
        const paymentValue =
            parameters.payment_value !== undefined && parameters.payment_value !== null
                ? parseFloat(parameters.payment_value)
                : null;
        const overduePenalty =
            parameters.overdue_penalty !== undefined && parameters.overdue_penalty !== null
                ? parseFloat(parameters.overdue_penalty)
                : 0.0;

        if (!paymentValue || paymentValue < 1.0) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: "Please create a payment of at least $1.00.",
                    payment_value: paymentValue
                })
            };
        }

        if (overduePenalty < 0.0) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: "Please create a penalty of at least $0.00.",
                    overdue_penalty: overduePenalty
                })
            };
        }

        const result = await query(
            `
            INSERT INTO payments (
                title,
                created_at,
                due_date,
                payment_value,
                overdue_penalty
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            `,
            [title, createdAt, dueDate, paymentValue, overduePenalty]
        );

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Payment created successfully.",
                data: result.rows[0]
            })
        };

    } catch (err) {
        console.error("createPayment error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};