const { query } = require("../../shared_utils/db");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");

const ASSIGNED_PAYMENTS_TABLE = "assigned_payments";

const REQUIRED_FIELDS = ["member_id", "payment_id"];
const UPDATE_FIELDS = ["assigned_on", "status"];

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const parameters = JSON.parse(event.body || "{}");
        const ids = {};
        const payload = {};

        for (const field of REQUIRED_FIELDS) {
            if (parameters[field] === undefined || parameters[field] === null) {
                return {
                    statusCode: 400,
                    body: `${field} is missing from your request, please include it.`
                };
            }
            ids[field] = parameters[field];
        }

        for (const field of UPDATE_FIELDS) {
            if (field in parameters) {
                payload[field] = parameters[field];
            }
        }

        if (Object.keys(payload).length === 0) {
            return {
                statusCode: 400,
                body: "No update fields provided."
            };
        }

        const memberId = parseInt(ids.member_id, 10);
        const paymentId = parseInt(ids.payment_id, 10);

        if (Number.isNaN(memberId) || Number.isNaN(paymentId)) {
            return {
                statusCode: 400,
                body: "member_id and payment_id must be valid numbers."
            };
        }

        const updateKeys = Object.keys(payload);

        const setClause = updateKeys
            .map((key, index) => `${key} = $${index + 1}`)
            .join(", ");

        const values = [
            ...updateKeys.map((key) => payload[key]),
            memberId,
            paymentId
        ];

        const result = await query(
            `
            UPDATE ${ASSIGNED_PAYMENTS_TABLE}
            SET ${setClause}
            WHERE member_id = $${updateKeys.length + 1}
              AND payment_id = $${updateKeys.length + 2}
            RETURNING member_id, payment_id, assigned_on, status
            `,
            values
        );

        if (result.rowCount === 0) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Assigned payment not found." })
            };
        }

        const data = result.rows[0];

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                payment_id: data.payment_id,
                member_id: data.member_id,
                data
            })
        };

    } catch (err) {
        console.error("updateAssignedPayment error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};