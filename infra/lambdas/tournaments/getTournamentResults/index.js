const { query } = require("../../shared_utils/db");

const HEADERS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

exports.handler = async (event) => {
    try {
        const params = event.queryStringParameters ?? {};
        let result;

        if (params.event_id) {
            result = await query(
                `SELECT * FROM tournament_results
                 WHERE event_id = $1
                 ORDER BY division, placement, member_name`,
                [parseInt(params.event_id)]
            );
        } else if (params.member_id) {
            result = await query(
                `SELECT tr.*, e.event_name, e.event_date
                 FROM tournament_results tr
                 JOIN events e ON e.event_id = tr.event_id
                 WHERE tr.member_id = $1
                 ORDER BY e.event_date DESC`,
                [parseInt(params.member_id)]
            );
        } else {
            result = await query(
                `SELECT tr.*, e.event_name, e.event_date
                 FROM tournament_results tr
                 JOIN events e ON e.event_id = tr.event_id
                 ORDER BY e.event_date DESC, tr.division, tr.placement`,
                []
            );
        }

        return {
            statusCode: 200,
            headers: HEADERS,
            body: JSON.stringify({ data: result.rows })
        };
    } catch (err) {
        console.error("getTournamentResults error:", err);
        return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
    }
};
