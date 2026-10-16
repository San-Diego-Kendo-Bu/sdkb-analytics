const { query } = require("../../shared_utils/db");

const EVENT_CARPOOLS_TABLE = "event_carpools";
const CARPOOL_FIELDS = ["event_id", "member_id", "carpool_status"];

exports.handler = async (event) => {
    try {
        const parameters = JSON.parse(event.body || "{}");
        const payload = {};

        for (const field of CARPOOL_FIELDS) {
            if (field in parameters) {
                payload[field] = parameters[field];
            }
        }

        const keys = Object.keys(payload);

        const sql =
            keys.length === 0
                ? `SELECT * FROM ${EVENT_CARPOOLS_TABLE}`
                : `SELECT * FROM ${EVENT_CARPOOLS_TABLE} WHERE ` +
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
                message: "Carpool signup(s) retrieved successfully.",
                payload,
                body: result.rows,
            })
        };
    } catch (err) {
        console.error("getEventCarpools error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};
