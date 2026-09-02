const { query } = require("../../shared_utils/db");

const EVENTS_TABLE = "events";

exports.handler = async () => {
    try {
        // Delete special events whose effective end date (event_end_date if set,
        // otherwise event_date) is more than 2 days in the past. This cascades to
        // special_events and special_event_registrations via ON DELETE CASCADE.
        const result = await query(
            `
            DELETE FROM ${EVENTS_TABLE}
            WHERE event_type = 'special_event'
              AND COALESCE(event_end_date, event_date) < now() - INTERVAL '2 days'
            RETURNING event_id
            `
        );

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Past special events cleared successfully.",
                deleted_count: result.rowCount,
            })
        };
    } catch (err) {
        console.error("clearPastSpecialEvents error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};
