const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { getCurrentTimeUTC } = require("../../shared_utils/dates");
const { verifyMemberExists } = require("../../shared_utils/members");
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

async function processPaymentIntent(memberId, paymentId) {
    await query("BEGIN");
    try {
        const memberFound = await verifyMemberExists(memberId);
        if (!memberFound) {
            await query("ROLLBACK");
            return { statusCode: 400, body: "Invalid member ID." };
        }

        const submittedOn = getCurrentTimeUTC();

        const assignedResult = await query(
            `SELECT * FROM assigned_payments WHERE member_id = $1 AND payment_id = $2`,
            [memberId, paymentId]
        );
        if (assignedResult.rows.length === 0) {
            await query("ROLLBACK");
            // Could be a duplicate webhook — not an error
            console.log(`No assigned payment for member ${memberId}, payment ${paymentId} — skipping`);
            return { statusCode: 200, body: "No assigned payment found" };
        }

        const assignedRow = assignedResult.rows[0];

        // Idempotency check
        const alreadySubmitted = await query(
            `SELECT 1 FROM submitted_payments WHERE member_id = $1 AND payment_id = $2 LIMIT 1`,
            [memberId, paymentId]
        );
        if (alreadySubmitted.rowCount > 0) {
            await query("ROLLBACK");
            console.log(`Duplicate webhook: payment ${paymentId} already submitted for member ${memberId}`);
            return { statusCode: 200, body: "Already submitted" };
        }

        const paymentResult = await query(
            `SELECT payment_value, overdue_penalty, due_date, has_submission FROM payments WHERE payment_id = $1`,
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
            `INSERT INTO submitted_payments (member_id, payment_id, assigned_on, submitted_on, total_paid, overdue)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
                assignedRow.member_id,
                assignedRow.payment_id,
                assignedRow.assigned_on,
                submittedOn,
                totalPaid,
                overdue,
            ]
        );

        const submittedEntry = submitResult.rows[0];

        await query(
            `DELETE FROM assigned_payments WHERE member_id = $1 AND payment_id = $2`,
            [submittedEntry.member_id, submittedEntry.payment_id]
        );

        await query("COMMIT");

        console.log(`Payment ${paymentId} submitted successfully for member ${memberId}`);
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

    const stripeKey = secretObj.STRIPE_TEST_SECRET_KEY;
    const webhookSecret = secretObj.STRIPE_WEBHOOK_SECRET;

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

    if (Number.isNaN(memberId) || Number.isNaN(paymentId)) {
        console.error("Missing metadata on PaymentIntent:", intent.id);
        return { statusCode: 400, body: "Missing member_id or payment_id in PaymentIntent metadata" };
    }

    return processPaymentIntent(memberId, paymentId);
};
