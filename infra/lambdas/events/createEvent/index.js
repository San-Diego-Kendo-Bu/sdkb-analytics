const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
    DynamoDBDocumentClient,
    UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const { query } = require("../../shared_utils/db");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");
const { getCurrentTimeUTC } = require("../../shared_utils/dates");

const EVENTS_TABLE = "events";
const REGION = process.env.AWS_REGION;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const updateParams = {
            TableName: "appConfigs",
            Key: { type: "eventIdCounter" },
            UpdateExpression: "ADD #counter :val",
            ExpressionAttributeNames: { "#counter": "idCounter" },
            ExpressionAttributeValues: { ":val": 1 },
            ReturnValues: "ALL_NEW",
        };

        const updateResult = await ddb.send(new UpdateCommand(updateParams));
        const newEventId = updateResult.Attributes.idCounter;

        const parameters = JSON.parse(event.body || "{}");

        const eventName = parameters.event_name;
        const eventType = parameters.event_type;
        const createdAt = getCurrentTimeUTC();
        const eventDate = parameters.event_date;
        const eventDeadline = parameters.event_deadline;
        const eventLocation = parameters.event_location;
        const description = parameters.description ?? null;
        const paymentId = parameters.payment_id ? parseInt(parameters.payment_id, 10) : null;

        const conflict = await query(
            `SELECT event_id FROM ${EVENTS_TABLE} WHERE payment_id = $1 LIMIT 1`,
            [paymentId]
        );
        if (conflict.rowCount > 0) {
            return {
                statusCode: 409,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: `payment_id ${paymentId} is already linked to event ${conflict.rows[0].event_id}.` }),
            };
        }

        const result = await query(
            `
            INSERT INTO ${EVENTS_TABLE} (
                event_id,
                event_date,
                event_name,
                event_type,
                event_deadline,
                created_at,
                event_location,
                description,
                payment_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
            `,
            [
                newEventId,
                eventDate,
                eventName,
                eventType,
                eventDeadline,
                createdAt,
                eventLocation,
                description,
                paymentId,
            ]
        );

        const data = result.rows[0];

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                message: "Created Event Successfully",
                id: data.event_id,
                data,
            }),
        };
    } catch (err) {
        console.error("createEvent error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message }),
        };
    }
};