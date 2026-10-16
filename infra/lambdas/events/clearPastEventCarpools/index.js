const { query } = require("../../shared_utils/db");

const EVENT_CARPOOLS_TABLE = "event_carpools";
// Tournament, shinsa, and seminar events are never deleted outright (their event rows and
// registrations are kept indefinitely for history/results), so their carpool signups need
// their own cleanup once the event has actually happened. special_event isn't included here
// because its carpool rows already get cleared for free when clearPastSpecialEvents deletes
// the whole event row via ON DELETE CASCADE.
const CLEANUP_EVENT_TYPES = ["tournament", "shinsa", "seminar"];

exports.handler = async () => {
    try {
        // Carpooling coordination is only useful before an event happens — once the event's
        // own start date (not the sign-up deadline) has passed, there's nothing left to
        // coordinate, so clear its carpool signups.
        const result = await query(
            `
            DELETE FROM ${EVENT_CARPOOLS_TABLE}
            WHERE event_id IN (
                SELECT event_id FROM events
                WHERE event_type = ANY($1)
                  AND event_date < now()
            )
            RETURNING event_id
            `,
            [CLEANUP_EVENT_TYPES]
        );

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Past event carpool signups cleared successfully.",
                deleted_count: result.rowCount,
            })
        };
    } catch (err) {
        console.error("clearPastEventCarpools error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};
