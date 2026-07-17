const { query } = require("../../shared_utils/db");
const { getAllMembers } = require("../../shared_utils/members");
const { getCurrentTimeUTC } = require("../../shared_utils/dates");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");
const { sendEmails } = require("../../shared_utils/mailer");

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient, UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const REGION = process.env.AWS_REGION;
const APPCONFIGS_TABLE = "appConfigs";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const parameters = JSON.parse(event.body || "{}");

        const title = parameters.title;
        const createdAt = parameters.created_at || getCurrentTimeUTC();
        const dueDate = parameters.due_date;
        const paymentValue = parameters.payment_value
            ? parseFloat(parameters.payment_value)
            : null;
        const overduePenalty = parameters.overdue_penalty
            ? parseFloat(parameters.overdue_penalty)
            : 0.0;

        const federationDue = parameters.federation_due || false;
        const dojoDue = parameters.dojo_due || false;

        // --- validation ---
        if (federationDue && dojoDue) {
            return {
                statusCode: 400,
                body: "Payment cannot be both federation due and dojo due.",
            };
        }

        if (!federationDue && !dojoDue) {
            return {
                statusCode: 400,
                body: "Payment must be either federation due or dojo due.",
            };
        }

        if (!paymentValue || paymentValue < 1.0) {
            return {
                statusCode: 400,
                body: "Payment must be at least $1.00.",
            };
        }

        if (overduePenalty < 0.0) {
            return {
                statusCode: 400,
                body: "Overdue penalty must be >= 0.",
            };
        }

        const updateParams = {
              TableName: APPCONFIGS_TABLE,
              Key: { type: "paymentIdCounter" },
              UpdateExpression: "ADD #counter :val",
              ExpressionAttributeNames: { "#counter": "idCounter" },
              ExpressionAttributeValues: { ":val": 1 },
              ReturnValues: "ALL_NEW",
            };
        const updateResult = await ddb.send(new UpdateCommand(updateParams));
        const newPaymentId = updateResult.Attributes.idCounter;

        // --- 1. INSERT PAYMENT ---
        await query(
            `
            INSERT INTO payments (
                payment_id,
                created_at,
                payment_value,
                overdue_penalty,
                due_date,
                title,
                has_submission
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            [
                newPaymentId,
                createdAt,
                paymentValue,
                overduePenalty,
                dueDate,
                title,
                false 
            ]
        );

        console.log("Payment created:", newPaymentId);

        // --- 2. GET MEMBERS ---
        const allMembers = await getAllMembers();
        let filteredMembers = [];

        if (dojoDue) {
            filteredMembers = allMembers.filter(m => m.status !== "exempt" && m.status === "active");
        } else if (federationDue) {
            filteredMembers = allMembers.filter(m => m.status !== "guest" && m.status !== "inactive");
        }

        const memberIds = filteredMembers.map(m => m.member_id);
        const memberEmails = [...new Set(filteredMembers.map(m => m.email).filter(Boolean))];

        // --- 3. ASSIGN PAYMENT ---
        for (const memberId of memberIds) {
            await query(
                `
                INSERT INTO assigned_payments (
                    member_id,
                    payment_id,
                    assigned_on,
                    due_status
                )
                VALUES ($1, $2, $3, $4)
                `,
                [
                    memberId,
                    newPaymentId,
                    getCurrentTimeUTC(),
                    "due"
                ]
            );
        }

        // --- 4. EMAIL NOTIFICATIONS ---
        if (memberEmails.length > 0) {
            try {
                const dueDateStr = new Date(dueDate).toLocaleDateString("en-US", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric",
                });
                const amount = `$${parseFloat(paymentValue).toFixed(2)}`;
                const subject = `Payment Assigned: ${title}`;
                const html = `<p>A payment has been assigned to your account.</p><p><strong>Title:</strong> ${title}</p><p><strong>Amount:</strong> ${amount}</p><p><strong>Due Date:</strong> ${dueDateStr}</p><p>Log in to the SDKB portal to submit your payment: <a href="https://sdkbportal.org">sdkbportal.org</a></p>`;
                const text = `Payment Assigned: ${title}\n\nAmount: ${amount}\nDue Date: ${dueDateStr}\n\nLog in to the SDKB portal to submit your payment: https://sdkbportal.org`;
                await sendEmails(memberEmails, subject, html, text);
            } catch (emailErr) {
                console.error("Broadcast payment email error:", emailErr);
            }
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Payment created and assigned successfully.",
                payment_id: newPaymentId,
                assigned_member_count: memberIds.length,
            }),
        };

    } catch (err) {
        console.error("createPayment error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message }),
        };
    }
};