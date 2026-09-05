const { query } = require("../../shared_utils/db");

const TOURNAMENTS_TABLE = "tournaments";
const TOURNAMENT_DIVISION_PAYMENTS_TABLE = "tournament_division_payments";
const SHINSA_TABLE = "shinsa_exams";
const SEMINAR_TABLE = "seminars";
const SPECIAL_EVENTS_TABLE = "special_events";
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
                `
                SELECT
                    t.event_id,
                    t.shinpan_needed,
                    t.divisions,
                    t.teams_included,
                    t.payment_required,
                    COALESCE(
                        jsonb_agg(
                            jsonb_build_object(
                                'payment_id', dp.payment_id::text,
                                'restriction_type', dp.age_restriction_type,
                                'age_limit', dp.age_limit
                            )
                        ) FILTER (WHERE dp.payment_id IS NOT NULL),
                        '[]'::jsonb
                    ) AS payment_options
                FROM ${TOURNAMENTS_TABLE} t
                LEFT JOIN ${TOURNAMENT_DIVISION_PAYMENTS_TABLE} dp ON dp.event_id = t.event_id
                WHERE t.event_id = $1
                GROUP BY t.event_id, t.shinpan_needed, t.divisions, t.teams_included, t.payment_required
                LIMIT 1
                `,
                [eventId]
            );
        } else if (eventType === "shinsa") {
            configResult = await query(
                `SELECT event_id, shinsa_levels, external_signup_url FROM ${SHINSA_TABLE} WHERE event_id = $1 LIMIT 1`,
                [eventId]
            );
        } else if (eventType === "seminar") {
            configResult = await query(
                `SELECT event_id, seminar_guests, bring_your_lunch, external_signup_url FROM ${SEMINAR_TABLE} WHERE event_id = $1 LIMIT 1`,
                [eventId]
            );
        } else if (eventType === "special_event") {
            configResult = await query(
                `SELECT event_id, bring_your_lunch FROM ${SPECIAL_EVENTS_TABLE} WHERE event_id = $1 LIMIT 1`,
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
