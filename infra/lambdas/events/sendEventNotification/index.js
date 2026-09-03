const { getAllMembers } = require("../../shared_utils/members");
const { sendEmails } = require("../../shared_utils/mailer");

exports.handler = async (event) => {
    // Invoked asynchronously (fire-and-forget) by createEvent right after the event is
    // created, so a slow or stuck email batch can never block or fail the create-event
    // response. Errors are caught and logged, not rethrown: Lambda automatically retries
    // failed async invocations, which would otherwise risk sending duplicate emails.
    try {
        const { eventName, eventDate, eventDeadline, eventLocation, description } = event;

        const members = await getAllMembers();
        const emails = [...new Set(members.filter(m => m.status !== "inactive").map(m => m.email).filter(Boolean))];
        if (emails.length === 0) return;

        const eventDateStr = new Date(eventDate).toLocaleDateString("en-US", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
        });
        const deadlineStr = new Date(eventDeadline).toLocaleDateString("en-US", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
        });
        const subject = `New Event: ${eventName}`;
        const html = `
<h2>${eventName}</h2>
<p><strong>Date:</strong> ${eventDateStr}</p>
<p><strong>Location:</strong> ${eventLocation}</p>
<p><strong>Sign-up Deadline:</strong> ${deadlineStr}</p>
${description ? `<p>${description}</p>` : ""}
<p>Log in to the SDKB portal to sign up: <a href="https://sdkbportal.org">sdkbportal.org</a></p>`;
        const text = `New Event: ${eventName}\nDate: ${eventDateStr}\nLocation: ${eventLocation}\nSign-up Deadline: ${deadlineStr}${description ? `\n\n${description}` : ""}\n\nLog in to the SDKB portal to sign up: https://sdkbportal.org`;

        await sendEmails(emails, subject, html, text);
    } catch (err) {
        console.error("sendEventNotification error:", err);
    }
};
