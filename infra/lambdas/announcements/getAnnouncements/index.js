const { query } = require("../../shared_utils/db");

exports.handler = async () => {
    try {
        const result = await query(
            `SELECT announcement_id, subject, body, pdf_url, COALESCE(target, 'all') AS target, created_at
             FROM announcements
             ORDER BY created_at DESC`,
            []
        );
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ announcements: result.rows }),
        };
    } catch (err) {
        console.error("getAnnouncements error:", err);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message }),
        };
    }
};
