const { query } = require("../../shared_utils/db");

const EVENTS_TABLE = "events";
const FIELDS = [
    "event_id",
    "event_date",
    "event_name",
    "event_type",
    "event_deadline",
    "created_at",
    "event_location",
    "payment_id"
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
                ? `SELECT * FROM ${EVENTS_TABLE}`
                : `SELECT * FROM ${EVENTS_TABLE} WHERE ` +
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
                message: "Event(s) retrieved successfully.",
                payload,
                body: result.rows,
            })
        };

    } catch (err) {
        console.error("getEvents error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};