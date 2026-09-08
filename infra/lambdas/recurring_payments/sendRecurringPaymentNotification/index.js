const { sendEmails } = require("../../shared_utils/mailer");

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
}

async function sendPaymentJob({ emails, title, amount, dueDate }) {
    if (!emails?.length) return;
    const dueDateStr = formatDate(dueDate);
    const amountStr = `$${parseFloat(amount).toFixed(2)}`;
    const subject = `Payment Due: ${title}`;
    const html = `<p>A payment has been assigned to your account.</p><p><strong>Title:</strong> ${title}</p><p><strong>Amount:</strong> ${amountStr}</p><p><strong>Due Date:</strong> ${dueDateStr}</p><p>Log in to the SDKB portal to submit your payment: <a href="https://sdkbportal.org">sdkbportal.org</a></p>`;
    const text = `Payment Due: ${title}\n\nAmount: ${amountStr}\nDue Date: ${dueDateStr}\n\nLog in at https://sdkbportal.org`;
    await sendEmails(emails, subject, html, text);
}

async function sendNoticeJob({ emails, title, dueDate }) {
    if (!emails?.length) return;
    const dueDateStr = formatDate(dueDate);
    const subject = `Family Payment Notice: ${title}`;
    const html = `<p>A payment has been issued for your family.</p><p><strong>Title:</strong> ${title}</p><p><strong>Due Date:</strong> ${dueDateStr}</p><p>Log in to the SDKB portal for details: <a href="https://sdkbportal.org">sdkbportal.org</a></p>`;
    const text = `Family Payment Notice: ${title}\n\nDue Date: ${dueDateStr}\n\nLog in at https://sdkbportal.org`;
    await sendEmails(emails, subject, html, text);
}

exports.handler = async (event) => {
    // Invoked asynchronously (fire-and-forget) by createRecurring right after the first
    // payment cycle is created, so a slow or stuck email batch can never block or fail
    // the create-recurring-payment response. Errors are caught and logged per job, not
    // rethrown: Lambda automatically retries failed async invocations, which would
    // otherwise risk sending duplicate emails.
    const { jobs } = event;
    if (!Array.isArray(jobs)) return;

    for (const job of jobs) {
        try {
            if (job.type === "notice") {
                await sendNoticeJob(job);
            } else {
                await sendPaymentJob(job);
            }
        } catch (err) {
            console.error("sendRecurringPaymentNotification: job error:", err);
        }
    }
};
