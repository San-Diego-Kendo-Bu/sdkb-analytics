const { getCurrentTimeUTC } = require("../../shared_utils/dates");
const { query } = require("../../shared_utils/db");

const PAYMENTS_TABLE = "payments";
const SUBMITTED_PAYMENTS_TABLE = "submitted_payments";
const ASSIGNED_PAYMENTS_TABLE = "assigned_payments";

exports.handler = async () => {

    try {
        const currentTime = getCurrentTimeUTC();
        console.log("Current time UTC:", currentTime);

        await query("BEGIN");

        // Delete submitted payments tied to overdue payments with no assignments
        await query(
            `
            DELETE FROM ${SUBMITTED_PAYMENTS_TABLE} sp
            WHERE sp.payment_id IN (
                SELECT p.payment_id
                FROM ${PAYMENTS_TABLE} p
                WHERE p.due_date IS NOT NULL
                  AND p.due_date < $1
                  AND NOT EXISTS (
                      SELECT 1
                      FROM ${ASSIGNED_PAYMENTS_TABLE} ap
                      WHERE ap.payment_id = p.payment_id
                  )
            )
            `,
            [currentTime]
        );

        // Delete the overdue payments themselves
        await query(
            `
            DELETE FROM ${PAYMENTS_TABLE} p
            WHERE p.due_date IS NOT NULL
              AND p.due_date < $1
              AND NOT EXISTS (
                  SELECT 1
                  FROM ${ASSIGNED_PAYMENTS_TABLE} ap
                  WHERE ap.payment_id = p.payment_id
              )
            `,
            [currentTime]
        );

        await query("COMMIT");

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Overdue payments cleared successfully."
            })
        };
    } catch (err) {
        await query("ROLLBACK");
        console.error("clearOverduePayments error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};