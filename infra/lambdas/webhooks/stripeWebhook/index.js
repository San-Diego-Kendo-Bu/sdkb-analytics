const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { getCurrentTimeUTC } = require("../../shared_utils/dates");
const { verifyMemberExists, getMemberById } = require("../../shared_utils/members");
const { sendEmails } = require("../../shared_utils/mailer");
const { query } = require("../../shared_utils/db");
const Stripe = require("stripe");

const REGION = process.env.AWS_REGION;
const SECRET_ID = process.env.SECRET_ID;

const secrets = new SecretsManagerClient({ region: REGION });

async function getSecretValue(secretId) {
    const r = await secrets.send(new GetSecretValueCommand({ SecretId: secretId }));
    const raw = r.SecretString ?? Buffer.from(r.SecretBinary || "", "base64").toString("utf8");
    return JSON.parse(raw);
}

// Notifies whoever actually paid (the parent if they paid on behalf of a kid, otherwise the
// member themselves) that the payment succeeded. Runs after the DB transaction has already
// committed, so an email failure here never affects whether the payment itself gets recorded.
async function sendPaymentConfirmationEmail(memberId, paidByMemberId, title, totalPaid) {
    try {
        const payerId = paidByMemberId ?? memberId;
        const payerRecords = await getMemberById(payerId);
        const payer = payerRecords[0];
        if (!payer?.email) return;

        const isOnBehalf = paidByMemberId != null && Number(paidByMemberId) !== Number(memberId);
        let forWhom = "your";
        if (isOnBehalf) {
            const beneficiaryRecords = await getMemberById(memberId);
            const beneficiary = beneficiaryRecords[0];
            const beneficiaryName = beneficiary ? `${beneficiary.first_name} ${beneficiary.last_name}` : `member #${memberId}`;
            forWhom = `${beneficiaryName}'s`;
        }

        const amount = `$${totalPaid.toFixed(2)}`;
        const subject = `Payment Successful: ${title}`;
        const html = `<p>Hi ${payer.first_name ?? ""},</p><p>Your payment of <strong>${amount}</strong> for ${forWhom} <strong>${title}</strong> was successful.</p><p>Thank you!</p><p>— SDKB Portal</p>`;
        const text = `Hi ${payer.first_name ?? ""},\n\nYour payment of ${amount} for ${forWhom} ${title} was successful.\n\nThank you!\n\n— SDKB Portal`;

        await sendEmails([payer.email], subject, html, text);
    } catch (emailErr) {
        console.error("stripeWebhook: payment confirmation email error:", emailErr);
    }
}

async function processPaymentIntent(memberId, paymentId, paidByMemberId) {
    await query("BEGIN");
    try {
        const memberFound = await verifyMemberExists(memberId);
        if (!memberFound) {
            await query("ROLLBACK");
            return { statusCode: 400, body: "Invalid member ID." };
        }

        const submittedOn = getCurrentTimeUTC();

        // Idempotency check — this is the real duplicate-webhook guard, so it must run before
        // looking at assigned_payments. That row can legitimately be gone (or recreated with a
        // new assigned_on) by the time a successful charge's webhook arrives — e.g. the member
        // unregistered and re-registered for the event while the charge was still in flight —
        // without that meaning the charge itself should be discarded.
        const alreadySubmitted = await query(
            `SELECT 1 FROM submitted_payments WHERE member_id = $1 AND payment_id = $2 LIMIT 1`,
            [memberId, paymentId]
        );
        if (alreadySubmitted.rowCount > 0) {
            await query("ROLLBACK");
            console.log(`Duplicate webhook: payment ${paymentId} already submitted for member ${memberId}`);
            return { statusCode: 200, body: "Already submitted" };
        }

        // The assigned_payments row is only used for its assigned_on timestamp when present.
        // Its absence is NOT treated as "nothing to do": createPaymentIntent already verified
        // eligibility before Stripe charged the card, so a successful charge is always recorded
        // here even if the assignment row has since changed for unrelated reasons.
        const assignedResult = await query(
            `SELECT * FROM assigned_payments WHERE member_id = $1 AND payment_id = $2`,
            [memberId, paymentId]
        );
        if (assignedResult.rows.length === 0) {
            console.warn(`stripeWebhook: no assigned_payments row for member ${memberId}, payment ${paymentId} at submission time — recording the payment anyway.`);
        }
        const assignedRow = assignedResult.rows[0] ?? null;

        const paymentResult = await query(
            `SELECT title, payment_value, overdue_penalty, due_date, has_submission FROM payments WHERE payment_id = $1`,
            [paymentId]
        );
        if (paymentResult.rows.length === 0) {
            await query("ROLLBACK");
            return { statusCode: 404, body: "Payment not found" };
        }

        const paymentRow = paymentResult.rows[0];

        if (!paymentRow.has_submission) {
            await query(
                `UPDATE payments SET has_submission = TRUE WHERE payment_id = $1`,
                [paymentId]
            );
        }

        const submittedDateStr = new Date(submittedOn).toISOString().slice(0, 10);
        const dueDateStr = paymentRow.due_date ? new Date(paymentRow.due_date).toISOString().slice(0, 10) : '';
        const overdue = !!dueDateStr && submittedDateStr > dueDateStr;
        const totalPaid = parseFloat(paymentRow.payment_value) + (overdue ? parseFloat(paymentRow.overdue_penalty ?? 0) : 0);

        const submitResult = await query(
            `INSERT INTO submitted_payments (member_id, payment_id, assigned_on, submitted_on, total_paid, overdue, paid_by_member_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [
                memberId,
                paymentId,
                assignedRow?.assigned_on ?? submittedOn,
                submittedOn,
                totalPaid,
                overdue,
                paidByMemberId,
            ]
        );

        const submittedEntry = submitResult.rows[0];

        // Harmless no-op if the row is already gone (e.g. the case handled above).
        await query(
            `DELETE FROM assigned_payments WHERE member_id = $1 AND payment_id = $2`,
            [memberId, paymentId]
        );

        await query("COMMIT");

        console.log(`Payment ${paymentId} submitted successfully for member ${memberId}`);
        await sendPaymentConfirmationEmail(memberId, paidByMemberId, paymentRow.title, totalPaid);
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Payment submitted successfully.", data: submittedEntry }),
        };
    } catch (err) {
        await query("ROLLBACK");
        console.error("stripeWebhook processPaymentIntent error:", err);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message }),
        };
    }
}

exports.handler = async (event) => {
    const sig = event.headers?.["stripe-signature"];
    const rawBody = event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString("utf8")
        : event.body;

    if (!sig || !rawBody) {
        return { statusCode: 400, body: "Missing stripe-signature header or body" };
    }

    let secretObj;
    try {
        secretObj = await getSecretValue(SECRET_ID);
    } catch (err) {
        console.error("Failed to retrieve secret:", err);
        return { statusCode: 500, body: "Internal error" };
    }

    const stripeKey = secretObj.STRIPE_PROD_SECRET_KEY;
    const webhookSecret = secretObj.STRIPE_PROD_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error("STRIPE_WEBHOOK_SECRET not found in secret");
        return { statusCode: 500, body: "Webhook secret not configured" };
    }

    const stripe = new Stripe(stripeKey);

    let stripeEvent;
    try {
        stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
        console.error("Stripe signature verification failed:", err.message);
        return { statusCode: 400, body: `Webhook error: ${err.message}` };
    }

    if (stripeEvent.type !== "payment_intent.succeeded") {
        return { statusCode: 200, body: "Ignored" };
    }

    const intent = stripeEvent.data.object;
    const memberId = parseInt(intent.metadata?.member_id, 10);
    const paymentId = parseInt(intent.metadata?.payment_id, 10);
    const paidByRaw = intent.metadata?.paid_by_member_id;
    const paidByParsed = paidByRaw ? parseInt(paidByRaw, 10) : NaN;
    const paidByMemberId = Number.isNaN(paidByParsed) ? null : paidByParsed;

    if (Number.isNaN(memberId) || Number.isNaN(paymentId)) {
        console.error("Missing metadata on PaymentIntent:", intent.id);
        return { statusCode: 400, body: "Missing member_id or payment_id in PaymentIntent metadata" };
    }

    return processPaymentIntent(memberId, paymentId, paidByMemberId);
};
