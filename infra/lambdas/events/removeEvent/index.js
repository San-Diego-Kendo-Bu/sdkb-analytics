const { query } = require("../../shared_utils/db");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");

const EVENTS_TABLE = "events";

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const parameters = JSON.parse(event.body || "{}");
        const eventId = parseInt(parameters.event_id, 10);

        if (Number.isNaN(eventId)) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Please specify a valid event id" })
            };
        }

        const result = await query(
            `
            DELETE FROM ${EVENTS_TABLE}
            WHERE event_id = $1
            RETURNING
                event_id,
                event_date,
                event_name,
                event_type,
                event_deadline,
                created_at,
                event_location,
                payment_id
            `,
            [eventId]
        );

        if (result.rowCount === 0) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Event not found" })
            };
        }

        const data = result.rows[0];

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                message: "Deleted Event Successfully",
                id: data.event_id,
                data,
            })
        };

    } catch (err) {
        console.error("deleteEvent error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};