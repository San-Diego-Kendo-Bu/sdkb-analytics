const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { getMemberById } = require("../../shared_utils/members");
const { query } = require("../../shared_utils/db");
const Stripe = require("stripe");

const REGION = process.env.AWS_REGION;
const SECRET_ID = process.env.SECRET_ID;
const PK_SECRET_ID = process.env.PK_SECRET_ID;

const secrets = new SecretsManagerClient({ region: REGION });

async function getSecretValue(secretId) {
    const r = await secrets.send(new GetSecretValueCommand({ SecretId: secretId }));
    const raw = r.SecretString ?? Buffer.from(r.SecretBinary || "", "base64").toString("utf8");
    return JSON.parse(raw);
}

exports.handler = async (event) => {
    try {
        const params = JSON.parse(event.body || "{}");
        const memberId = parseInt(params.member_id, 10);
        const paymentId = parseInt(params.payment_id, 10);

        if (Number.isNaN(memberId) || Number.isNaN(paymentId)) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "member_id and payment_id are required numbers" }),
            };
        }

        // Verify this member has this payment assigned
        const assignedResult = await query(
            `SELECT 1 FROM assigned_payments WHERE member_id = $1 AND payment_id = $2 LIMIT 1`,
            [memberId, paymentId]
        );
        if (assignedResult.rowCount === 0) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Assigned payment not found" }),
            };
        }

        // Get customer_id from DynamoDB
        const members = await getMemberById(memberId);
        if (!members.length) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Member not found" }),
            };
        }
        const customerId = members[0].customer_id;

        // Get payment details from PostgreSQL
        const paymentResult = await query(
            `SELECT payment_value, overdue_penalty, due_date FROM payments WHERE payment_id = $1 LIMIT 1`,
            [paymentId]
        );
        if (paymentResult.rowCount === 0) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Payment not found" }),
            };
        }

        const { payment_value, overdue_penalty, due_date } = paymentResult.rows[0];
        const todayStr = new Date().toISOString().slice(0, 10);
        const dueDateStr = due_date ? new Date(due_date).toISOString().slice(0, 10) : '';
        const isOverdue = !!dueDateStr && todayStr > dueDateStr;
        const total = parseFloat(payment_value) + (isOverdue ? parseFloat(overdue_penalty ?? 0) : 0);
        const amountCents = Math.round(total * 100);

        const [secretObj, pkObj] = await Promise.all([
            getSecretValue(SECRET_ID),
            getSecretValue(PK_SECRET_ID),
        ]);

        const stripe = new Stripe(secretObj.STRIPE_TEST_SECRET_KEY);
        const publishableKey = pkObj.STRIPE_TEST_PUBLISHABLE_KEY;

        const intent = await stripe.paymentIntents.create({
            amount: amountCents,
            currency: "usd",
            customer: customerId,
            payment_method_types: ["card"],
            metadata: {
                member_id: String(memberId),
                payment_id: String(paymentId),
            },
        });

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                client_secret: intent.client_secret,
                publishable_key: publishableKey,
            }),
        };

    } catch (err) {
        console.error("createPaymentIntent error:", err);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message }),
        };
    }
};
