const { query } = require("../../shared_utils/db");

const H = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

exports.handler = async () => {
    try {
        const result = await query(`
            SELECT p.payment_id, p.title, p.payment_value, p.overdue_penalty,
                   rp.interval_months, rp.broadcast_target, rp.next_due_date, rp.created_at,
                   rp.designated_parents
            FROM recurring_payments rp
            JOIN payments p ON rp.payment_id = p.payment_id
            WHERE rp.is_active = true
            ORDER BY rp.next_due_date
        `);
        return {
            statusCode: 200,
            headers: H,
            body: JSON.stringify({ recurring_payments: result.rows }),
        };
    } catch (err) {
        console.error("getRecurrings error:", err);
        return { statusCode: 500, headers: H, body: JSON.stringify({ error: err.message }) };
    }
};
