const { getCurrentTimeUTC } = require("../../shared_utils/dates");
const { getDbPool } = require("../../shared_utils/db");

exports.handler = async () => {
    const pool = await getDbPool();
    const client = await pool.connect();

    try {
        const currentTime = getCurrentTimeUTC();
        console.log("Current time UTC:", currentTime);

        await client.query("BEGIN");

        await client.query(
            `
            WITH clean_payments AS (
                SELECT payment_id
                FROM "Payments"
                WHERE payment_id NOT IN (
                    SELECT ap.payment_id
                    FROM "AssignedPayments" ap
                    GROUP BY ap.payment_id
                )
                AND due_date IS NOT NULL
                AND $1 > due_date
            ),
            deleted_submissions AS (
                DELETE FROM "SubmittedPayments" sp
                USING clean_payments p
                WHERE sp.payment_id = p.payment_id
            )
            DELETE FROM "Payments" p
            USING clean_payments c
            WHERE p.payment_id = c.payment_id
            `,
            [currentTime]
        );

        await client.query(
            `SELECT replace_overdue_payments($1)`,
            [currentTime]
        );

        await client.query("COMMIT");

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Overdue payments cleared successfully."
            })
        };
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("clearOverduePayments error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    } finally {
        client.release();
    }
};