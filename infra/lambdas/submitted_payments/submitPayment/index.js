const { getCurrentTimeUTC } = require("../../shared_utils/dates");
const { verifyMemberExists } = require("../../shared_utils/members");
const { query } = require("../../shared_utils/db");

const REQUIRED_FIELDS = ["member_id", "payment_id"];
const SUBMIT_TABLE = "submitted_payments";
const PAYMENTS_TABLE = "payments";
const ASSIGNED_PAYMENTS_TABLE = "assigned_payments";

exports.handler = async (event) => {

    await query("BEGIN");

    try {
        const parameters = JSON.parse(event.body);
        const payload = {};

        for (const field of REQUIRED_FIELDS) {
            if (!parameters[field]) {
                return {
                    statusCode: 400,
                    body: `${field} is missing from your request, please include it.`
                };
            }
            payload[field] = parameters[field];
        }

        const memberId = parseInt(payload['member_id']);
        const memberFound = await verifyMemberExists(memberId);

        if (!memberFound) {
            return { statusCode: 400, body: "Invalid member ID." };
        }

        payload['submitted_on'] = getCurrentTimeUTC();

        // 1. Find matching assigned payment
        const assignedResult = await query(
            `
            SELECT *
            FROM ${ASSIGNED_PAYMENTS_TABLE}
            WHERE member_id = $1 AND payment_id = $2
            `,
            [payload.member_id, payload.payment_id]
        );

        if (assignedResult.rows.length === 0) {
            throw new Error("Assigned payment not found.");
        }

        const assignedRow = assignedResult.rows[0];

        // 2. Find payment info
        const paymentResult = await query(
            `
            SELECT payment_value, overdue_penalty, due_date, has_submission
            FROM ${PAYMENTS_TABLE}
            WHERE payment_id = $1
            `,
            [payload.payment_id]
        );

        if (paymentResult.rows.length === 0) {
            throw new Error("Payment was not found.");
        }

        const paymentRow = paymentResult.rows[0];

        // 3. Mark payment as having submissions
        if (!paymentRow.has_submission) {
            await query(
                `
                UPDATE ${PAYMENTS_TABLE}
                SET has_submission = TRUE
                WHERE payment_id = $1
                `,
                [payload.payment_id]
            );
        }

         // 4. Insert into submitted_payments
        const overdue = new Date(payload.submitted_on) > new Date(paymentRow.due_date);

        const submitResult = await query(
            `
            INSERT INTO ${SUBMIT_TABLE}
                (member_id, payment_id, assigned_on, submitted_on, total_paid, overdue)
            VALUES
                ($1, $2, $3, $4, $5, $6)
            RETURNING *
            `,
            [
                assignedRow.member_id,
                assignedRow.payment_id,
                assignedRow.assigned_on,
                payload.submitted_on,
                paymentRow.payment_value,
                overdue
            ]
        );

        const submittedEntry = submitResult.rows[0];

        // 5. Delete from assigned_payments
        await query(
            `
            DELETE FROM ${ASSIGNED_PAYMENTS_TABLE}
            WHERE member_id = $1 AND payment_id = $2
            `,
            [submittedEntry.member_id, submittedEntry.payment_id]
        );

        await query("COMMIT");

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                message: "Payment submitted successfully.",
                data: submittedEntry
            })
        };

    } catch (err) {
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
}