const { query } = require("../../shared_utils/db");
const { getAllMembers } = require("../../shared_utils/members");
const { sendEmails } = require("../../shared_utils/mailer");

exports.handler = async () => {
    try {
        const [upcomingResult, overdueResult] = await Promise.all([
            // Upcoming: due date falls in [now+3d, now+4d)
            query(`
                SELECT ap.member_id, p.title, p.due_date, p.payment_value
                FROM assigned_payments ap
                JOIN payments p ON ap.payment_id = p.payment_id
                WHERE ap.due_status = 'due'
                  AND p.due_date >= NOW() + INTERVAL '3 days'
                  AND p.due_date <  NOW() + INTERVAL '4 days'
            `),
            // Overdue: every 7 days after the due date
            query(`
                SELECT ap.member_id, p.title, p.due_date, p.payment_value
                FROM assigned_payments ap
                JOIN payments p ON ap.payment_id = p.payment_id
                WHERE ap.due_status = 'overdue'
                  AND (CURRENT_DATE - p.due_date::date) > 0
                  AND (CURRENT_DATE - p.due_date::date) % 7 = 0
            `),
        ]);

        const allRows = [...upcomingResult.rows, ...overdueResult.rows];
        if (allRows.length === 0) {
            console.log("No payment reminders to send today.");
            return { statusCode: 200, body: "No reminders needed" };
        }

        const allMembers = await getAllMembers();
        const memberEmailMap = new Map(
            allMembers.filter(m => m.status !== "inactive").map(m => [String(m.member_id), m.email])
        );

        const upcomingIds = new Set(upcomingResult.rows.map(r => `${r.member_id}:${r.title}`));

        let sent = 0;
        for (const row of allRows) {
            const email = memberEmailMap.get(String(row.member_id));
            if (!email) continue;

            const isOverdue = !upcomingIds.has(`${row.member_id}:${row.title}`);
            const dueDateStr = new Date(row.due_date).toLocaleDateString("en-US", {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
            });
            const amount = `$${parseFloat(row.payment_value).toFixed(2)}`;

            const subject = isOverdue
                ? `Overdue: "${row.title}" payment past due`
                : `Reminder: "${row.title}" is due in 3 days`;
            const html = isOverdue
                ? `<p>Hi,</p><p>Your payment <strong>${row.title}</strong> was due on <strong>${dueDateStr}</strong> and is still outstanding.</p><p><strong>Amount:</strong> ${amount}</p><p>Please log in to the SDKB portal to submit your payment as soon as possible: <a href="https://sdkbportal.org">sdkbportal.org</a></p><p>— SDKB Portal</p>`
                : `<p>Hi,</p><p>This is a friendly reminder that your payment <strong>${row.title}</strong> is due on <strong>${dueDateStr}</strong>.</p><p><strong>Amount:</strong> ${amount}</p><p>Please log in to the SDKB portal to submit your payment before the deadline: <a href="https://sdkbportal.org">sdkbportal.org</a></p><p>— SDKB Portal</p>`;
            const text = isOverdue
                ? `Overdue: "${row.title}" payment past due\n\nDue Date: ${dueDateStr}\nAmount: ${amount}\n\nPlease log in to the SDKB portal to submit your payment as soon as possible: https://sdkbportal.org`
                : `Reminder: "${row.title}" is due in 3 days\n\nDue Date: ${dueDateStr}\nAmount: ${amount}\n\nPlease log in to the SDKB portal to submit your payment before the deadline: https://sdkbportal.org`;

            try {
                await sendEmails([email], subject, html, text);
                sent++;
            } catch (err) {
                console.error(`Failed to send reminder to member ${row.member_id}:`, err);
            }
        }

        console.log(`Payment reminders sent: ${sent} (${upcomingResult.rows.length} upcoming, ${overdueResult.rows.length} overdue)`);
        return { statusCode: 200, body: `Sent ${sent} reminder(s)` };
    } catch (err) {
        console.error("paymentDeadlineReminder error:", err);
        return { statusCode: 500, body: err.message };
    }
};
