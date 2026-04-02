const { verifyMemberExists } = require("../../shared_utils/members");
const { getCurrentTimeUTC } = require("../../shared_utils/dates");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");
const { query } = require("../../shared_utils/db");

const REQUIRED_FIELDS = ["member_id", "payment_id"];

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const parameters = JSON.parse(event.body || "{}");
        const payload = {};

        for (const field of REQUIRED_FIELDS) {
            if (parameters[field] === undefined || parameters[field] === null) {
                return {
                    statusCode: 400,
                    body: `${field} is missing from your request, please include it.`
                };
            }
            payload[field] = parameters[field];
        }

        const memberId = parseInt(payload['member_id'], 10);
        const paymentId = parseInt(payload['payment_id'], 10);
        const assignedOn = getCurrentTimeUTC();
        const status = "due";

        const memberFound = await verifyMemberExists(memberId);
        if (!memberFound) {
            return { statusCode: 400, body: "Invalid member ID." };
        }

        const paymentCheck = await query(
            `SELECT 1 FROM payments WHERE payment_id = $1`,
            [paymentId]
        );

        if (paymentCheck.rowCount === 0) {
            return {
                statusCode: 400,
                body: "Invalid payment ID.",
            };
        }
        
        const result = await query(
            `
            INSERT INTO payment_assignments (
                member_id,
                payment_id,
                assigned_on,
                status
            )
            VALUES ($1, $2, $3, $4)
            RETURNING member_id, payment_id, assigned_on, status
            `,
            [memberId, paymentId, assignedOn, status]
        );

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Payment assigned successfully.",
                data: result.rows[0],
            }),
        };

    } catch (err) {
        console.error("assignPayments error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message }),
        };
    }
}