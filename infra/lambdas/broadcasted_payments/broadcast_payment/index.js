const { query } = require("../../shared_utils/db");
const { getAllMembers } = require("../../shared_utils/members");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");
const { sendEmails } = require("../../shared_utils/mailer");

function calcAge(birthday) {
    if (!birthday) return null;
    const today = new Date();
    const dob = new Date(birthday);
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
}

function filterTargets(allMembers, mode) {
    const active = (m) => m.status === "active";
    const notSensei = (m) => m.rank_type !== "shihan" && !(m.rank_type === "dan" && Number(m.rank_number) >= 4);

    if (mode === "adults") {
        return allMembers.filter(m => active(m) && notSensei(m) && !m.is_student && (calcAge(m.birthday) ?? Infinity) > 18);
    }
    if (mode === "students") {
        return allMembers.filter(m => active(m) && m.is_student === true);
    }
    if (mode === "kids") {
        return allMembers.filter(m => active(m) && !m.is_student && (calcAge(m.birthday) ?? Infinity) <= 18);
    }
    return allMembers.filter(m => m.status !== "guest" && m.status !== "inactive");
}

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const parameters = JSON.parse(event.body || "{}");
        const paymentId = parseInt(parameters.payment_id, 10);
        const mode = ["adults", "students", "kids"].includes(parameters.mode) ? parameters.mode : "all";

        if (!paymentId) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "payment_id is required." }),
            };
        }

        const paymentResult = await query(
            `SELECT title, due_date, payment_value FROM payments WHERE payment_id = $1`,
            [paymentId]
        );
        if (paymentResult.rowCount === 0) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Invalid payment ID." }),
            };
        }
        const payment = paymentResult.rows[0];

        const todayStr = new Date().toISOString().slice(0, 10);
        const dueDateStr10 = payment.due_date ? new Date(payment.due_date).toISOString().slice(0, 10) : null;
        const dueStatus = dueDateStr10 && todayStr > dueDateStr10 ? "overdue" : "due";

        const allMembers = await getAllMembers();
        const demographicTargets = filterTargets(allMembers, mode);

        const paidRows = await query(
            `SELECT member_id FROM submitted_payments WHERE payment_id = $1`,
            [paymentId]
        );
        const alreadyPaid = new Set(paidRows.rows.map(r => Number(r.member_id)));
        const toAssign = demographicTargets.filter(m => !alreadyPaid.has(Number(m.member_id)));

        const assignedOn = new Date().toISOString();
        let assignedCount = 0;
        const newlyAssignedMembers = [];

        for (const member of toAssign) {
            try {
                const result = await query(
                    `
                    INSERT INTO assigned_payments (
                        member_id,
                        payment_id,
                        assigned_on,
                        due_status
                    )
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (payment_id, member_id) DO NOTHING
                    `,
                    [member.member_id, paymentId, assignedOn, dueStatus]
                );
                if (result.rowCount > 0) {
                    assignedCount++;
                    newlyAssignedMembers.push(member);
                }
            } catch (insertErr) {
                console.error(`broadcastPayment: failed to assign member ${member.member_id}:`, insertErr);
            }
        }

        const memberEmails = [...new Set(newlyAssignedMembers.map(m => m.email).filter(Boolean))];
        if (memberEmails.length > 0) {
            try {
                const dueDateLabel = payment.due_date
                    ? new Date(payment.due_date).toLocaleDateString("en-US", {
                        weekday: "long", year: "numeric", month: "long", day: "numeric",
                    })
                    : "N/A";
                const amount = `$${parseFloat(payment.payment_value).toFixed(2)}`;
                const subject = `Payment Assigned: ${payment.title}`;
                const html = `<p>A payment has been assigned to your account.</p><p><strong>Title:</strong> ${payment.title}</p><p><strong>Amount:</strong> ${amount}</p><p><strong>Due Date:</strong> ${dueDateLabel}</p><p>Log in to the SDKB portal to submit your payment: <a href="https://sdkbportal.org">sdkbportal.org</a></p>`;
                const text = `Payment Assigned: ${payment.title}\n\nAmount: ${amount}\nDue Date: ${dueDateLabel}\n\nLog in to the SDKB portal to submit your payment: https://sdkbportal.org`;
                await sendEmails(memberEmails, subject, html, text);
            } catch (emailErr) {
                console.error("Broadcast payment email error:", emailErr);
            }
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Broadcast completed.",
                assigned_count: assignedCount,
                total_targets: demographicTargets.length,
            }),
        };

    } catch (err) {
        console.error("broadcastPayment error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message }),
        };
    }
};
