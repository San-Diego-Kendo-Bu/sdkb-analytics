const { getMemberById } = require("../../shared_utils/members");
const { getCurrentTimeUTC } = require("../../shared_utils/dates");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");
const { query } = require("../../shared_utils/db");
const { sendEmails } = require("../../shared_utils/mailer");

const REQUIRED_FIELDS = ["member_id", "payment_id"];

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const parameters = JSON.parse(event.body || "{}");
        const payload = {};

        for (const field of REQUIRED_FIELDS) {
            if (parameters[field] === undefined || parameters[field] === null) {
                return {
                    statusCode: 400,
                    body: `${field} is missing from your request, please include it.`
                };
            }
            payload[field] = parameters[field];
        }

        const memberId = parseInt(payload['member_id'], 10);
        const paymentId = parseInt(payload['payment_id'], 10);
        const assignedOn = getCurrentTimeUTC();
        const status = parameters['due_status'] === 'overdue' ? 'overdue' : 'due';

        const memberItems = await getMemberById(memberId);
        if (memberItems.length === 0) {
            return { statusCode: 400, body: "Invalid member ID." };
        }
        const memberEmail = memberItems[0]?.email;

        const paymentCheck = await query(
            `SELECT title, due_date, payment_value FROM payments WHERE payment_id = $1`,
            [paymentId]
        );

        if (paymentCheck.rowCount === 0) {
            return {
                statusCode: 400,
                body: "Invalid payment ID.",
            };
        }
        const payment = paymentCheck.rows[0];

        const alreadyPaid = await query(
            `SELECT 1 FROM submitted_payments WHERE member_id = $1 AND payment_id = $2 LIMIT 1`,
            [memberId, paymentId]
        );
        if (alreadyPaid.rowCount > 0) {
            return {
                statusCode: 409,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Member has already submitted this payment." }),
            };
        }

        const result = await query(
            `
            INSERT INTO assigned_payments (
                member_id,
                payment_id,
                assigned_on,
                due_status
            )
            VALUES ($1, $2, $3, $4)
            RETURNING member_id, payment_id, assigned_on, due_status
            `,
            [memberId, paymentId, assignedOn, status]
        );

        // Notify the member about their new payment assignment
        if (memberEmail) {
            try {
                const dueDateStr = new Date(payment.due_date).toLocaleDateString("en-US", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric",
                });
                const amount = `$${parseFloat(payment.payment_value).toFixed(2)}`;
                const subject = `Payment Assigned: ${payment.title}`;
                const html = `<p>A payment has been assigned to your account.</p><p><strong>Title:</strong> ${payment.title}</p><p><strong>Amount:</strong> ${amount}</p><p><strong>Due Date:</strong> ${dueDateStr}</p><p>Log in to the SDKB portal to submit your payment: <a href="https://sdkbportal.org">sdkbportal.org</a></p>`;
                const text = `Payment Assigned: ${payment.title}\n\nAmount: ${amount}\nDue Date: ${dueDateStr}\n\nLog in to the SDKB portal to submit your payment: https://sdkbportal.org`;
                await sendEmails([memberEmail], subject, html, text);
            } catch (emailErr) {
                console.error("Payment assignment email error:", emailErr);
            }
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Payment assigned successfully.",
                data: result.rows[0],
            }),
        };

    } catch (err) {
        console.error("assignPayments error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message }),
        };
    }
}