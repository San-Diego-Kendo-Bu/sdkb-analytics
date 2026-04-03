const { query } = require("../../shared_utils/db");

const PAYMENTS_TABLE = "payments";
const FIELDS = [
    "payment_id",
    "title",
    "created_at",
    "due_date",
    "payment_value",
    "overdue_penalty"
];

exports.handler = async (event) => {
    try {
        const parameters = event.headers || {};
        const payload = {};

        for (const field of FIELDS) {
            if (field in parameters) {
                payload[field] = parameters[field];
            }
        }

        const keys = Object.keys(payload);

        const sql =
            keys.length === 0
                ? `SELECT * FROM ${PAYMENTS_TABLE}`
                : `SELECT * FROM ${PAYMENTS_TABLE} WHERE ` +
                  keys.map((key, index) => `${key} = $${index + 1}`).join(" AND ");

        const values = keys.map((key) => payload[key]);

        const result = await query(sql, values);

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Data retrieved successfully",
                length: result.rows.length,
                data: result.rows
            })
        };

    } catch (err) {
        console.error("getPayments error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};