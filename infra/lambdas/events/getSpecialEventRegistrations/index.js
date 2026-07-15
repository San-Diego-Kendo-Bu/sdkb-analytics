const { query } = require("../../shared_utils/db");

const SPECIAL_EVENT_REGISTRATION_TABLE = "special_event_registrations";

const FIELDS = ["event_id", "member_id", "registration_date"];

exports.handler = async (event) => {
    try {
        const parameters = JSON.parse(event.body || "{}");
        const payload = {};

        for (const field of FIELDS) {
            if (field in parameters) {
                payload[field] = parameters[field];
            }
        }

        const keys = Object.keys(payload);

        const sql =
            keys.length === 0
                ? `SELECT * FROM ${SPECIAL_EVENT_REGISTRATION_TABLE}`
                : `SELECT * FROM ${SPECIAL_EVENT_REGISTRATION_TABLE} WHERE ` +
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
                message: "Registration(s) retrieved successfully.",
                payload,
                body: result.rows,
            })
        };

    } catch (err) {
        console.error("getSpecialEventRegistrations error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};
