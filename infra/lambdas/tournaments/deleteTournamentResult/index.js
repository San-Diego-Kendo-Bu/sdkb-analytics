const { query } = require("../../shared_utils/db");

const HEADERS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

exports.handler = async (event) => {
    try {
        const params = event.queryStringParameters ?? {};

        if (params.result_id) {
            await query("DELETE FROM tournament_results WHERE result_id = $1", [parseInt(params.result_id)]);
            return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ message: "Result deleted" }) };
        }

        if (params.event_id) {
            await query("DELETE FROM tournament_results WHERE event_id = $1", [parseInt(params.event_id)]);
            return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ message: "All results for event deleted" }) };
        }

        return {
            statusCode: 400,
            headers: HEADERS,
            body: JSON.stringify({ error: "result_id or event_id query parameter required" })
        };
    } catch (err) {
        console.error("deleteTournamentResult error:", err);
        return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
    }
};
