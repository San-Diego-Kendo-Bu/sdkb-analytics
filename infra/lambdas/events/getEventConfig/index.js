const { query } = require("../../shared_utils/db");

const TOURNAMENTS_TABLE = "tournaments";
const SHINSA_TABLE = "shinsa_exams";
const SEMINAR_TABLE = "seminars";
const EVENTS_TABLE = "events";

exports.handler = async (event) => {
    try {
        const eventId = event.queryStringParameters?.event_id;

        if (!eventId) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: "Missing event_id query parameter" }),
            };
        }

        const eventResult = await query(
            `SELECT event_type FROM ${EVENTS_TABLE} WHERE event_id = $1 LIMIT 1`,
            [eventId]
        );

        if (eventResult.rows.length === 0) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: "Event not found" }),
            };
        }

        const eventType = eventResult.rows[0].event_type;
        let configResult;

        if (eventType === "tournament") {
            configResult = await query(
                `SELECT event_id, shinpan_needed, divisions, teams_included FROM ${TOURNAMENTS_TABLE} WHERE event_id = $1 LIMIT 1`,
                [eventId]
            );
        } else if (eventType === "shinsa") {
            configResult = await query(
                `SELECT event_id, shinsa_levels FROM ${SHINSA_TABLE} WHERE event_id = $1 LIMIT 1`,
                [eventId]
            );
        } else if (eventType === "seminar") {
            configResult = await query(
                `SELECT event_id, seminar_guests, bring_your_lunch FROM ${SEMINAR_TABLE} WHERE event_id = $1 LIMIT 1`,
                [eventId]
            );
        } else {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: "Unknown event type" }),
            };
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({
                message: "Event config retrieved successfully",
                event_type: eventType,
                data: configResult.rows[0] ?? null,
            }),
        };

    } catch (err) {
        console.error("getEventConfig error:", err);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: err.message }),
        };
    }
};
