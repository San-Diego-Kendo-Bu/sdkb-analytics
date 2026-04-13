const { normalizeGroups } = require("../../shared_utils/normalize_claim");
const { query } = require("../../shared_utils/db");

const SUBMITTED_PAYMENTS_TABLE = "submitted_payments";

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ??
        {};

    const groups = normalizeGroups(claims['cognito:groups']);
    const isAdmin = groups.some(g => g === 'admins' || g.endsWith(' admins'));

    if (!isAdmin) {
        return { statusCode: 403, body: 'Forbidden' };
    }

    try {

        const parameters = JSON.parse(event.body || "{}");
        const paymentId = parseInt(parameters.payment_id, 10);
        const memberId = parseInt(parameters.member_id, 10);

        const result = await query(
            `
            DELETE FROM ${SUBMITTED_PAYMENTS_TABLE}
            WHERE payment_id = $1 AND member_id = $2
            RETURNING
                member_id,
                payment_id,
                assigned_on,
                submitted_on,
                overdue,
                total_paid
            `,
            [paymentId, memberId]
        );

        if (result.rowCount === 0) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Submitted payment not found" })
            };
        }

        const data = result.rows[0];

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                message: "Deleted Submitted Payment Successfully",
                id: data.payment_id,
                data,
            })
        };

    } catch (err) {
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
}