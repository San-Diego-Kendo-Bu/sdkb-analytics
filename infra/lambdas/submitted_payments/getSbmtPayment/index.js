const SUBMITTED_PAYMENTS_TABLE = "submitted_payments";
const FIELDS = ["member_id", "payment_id", "assigned_on", "submitted_on", "overdue", "total_paid"];
const { query } = require("../../shared_utils/db");

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
                ? `SELECT * FROM ${SUBMITTED_PAYMENTS_TABLE}`
                : `SELECT * FROM ${SUBMITTED_PAYMENTS_TABLE} WHERE ` +
                keys.map((key, index) => `${key} = $${index + 1}`).join(" AND ");

        const values = keys.map((key) => payload[key]);
        const result = await query(sql, values);

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                message: "Submitted payments retrieved successfully.",
                data: result.rows
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