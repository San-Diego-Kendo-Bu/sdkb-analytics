const { query } = require("../../shared_utils/db");

const ASSIGNED_PAYMENTS_TABLE = "assigned_payments";
const FIELDS = ["member_id", "payment_id", "due_status", "assigned_on"];

exports.handler = async (event) => {
    try {
        const payload = {};
        const parameters = JSON.parse(event.body || "{}");

        for (const field of FIELDS) {
            if (field in parameters) {
                payload[field] = parameters[field];
            }
        }

        const keys = Object.keys(payload);

        const sql =
            keys.length === 0
                ? `SELECT * FROM ${ASSIGNED_PAYMENTS_TABLE}`
                : `SELECT * FROM ${ASSIGNED_PAYMENTS_TABLE} WHERE ` +
                keys.map((key, index) => `${key} = $${index + 1}`).join(" AND ");

        const values = keys.map((key) => payload[key]);
        const result = await query(sql, values);

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Data retrieved successfully",
                length: result.rows.length,
                data: result.rows,
            }),
        };

    } catch (err) {
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
}