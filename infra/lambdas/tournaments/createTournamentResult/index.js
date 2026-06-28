const { query } = require("../../shared_utils/db");

const HEADERS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

exports.handler = async (event) => {
    try {
        const body = JSON.parse(event.body || "{}");
        const { event_id, results } = body;

        if (!event_id || !Array.isArray(results) || results.length === 0) {
            return {
                statusCode: 400,
                headers: HEADERS,
                body: JSON.stringify({ error: "event_id and non-empty results array required" })
            };
        }

        const eventRes = await query(
            "SELECT event_date FROM events WHERE event_id = $1 LIMIT 1",
            [parseInt(event_id)]
        );
        if (!eventRes.rows.length) {
            return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: "Event not found" }) };
        }

        const eventDate = new Date(eventRes.rows[0].event_date);
        const now = new Date();
        const daysSince = (now - eventDate) / (1000 * 60 * 60 * 24);
        if (daysSince < 0 || daysSince > 7) {
            return {
                statusCode: 403,
                headers: HEADERS,
                body: JSON.stringify({ error: "Recording window has closed (7 days after tournament)" })
            };
        }

        await query("BEGIN");
        try {
            for (const r of results) {
                const { member_id, member_name, division, placement, is_teams } = r;
                if (!member_name || !division || !placement) continue;
                await query(
                    `INSERT INTO tournament_results (event_id, member_id, member_name, division, placement, is_teams)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [parseInt(event_id), member_id ? parseInt(member_id) : null, member_name, division, placement, !!is_teams]
                );
            }
            await query("COMMIT");
        } catch (innerErr) {
            await query("ROLLBACK");
            throw innerErr;
        }

        return {
            statusCode: 200,
            headers: HEADERS,
            body: JSON.stringify({ message: "Results recorded successfully" })
        };
    } catch (err) {
        console.error("createTournamentResult error:", err);
        return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
    }
};
