const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const H = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};
    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some(g => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const { order } = JSON.parse(event.body ?? "{}");
        if (!order || typeof order !== "object") {
            return { statusCode: 400, headers: H, body: JSON.stringify({ error: "order is required" }) };
        }
        await ddb.send(new PutCommand({
            TableName: "appConfigs",
            Item: { type: "nafudaOrder", order },
        }));
        return { statusCode: 200, headers: H, body: JSON.stringify({ message: "Saved" }) };
    } catch (err) {
        console.error("setNafudaOrder error:", err);
        return { statusCode: 500, headers: H, body: JSON.stringify({ error: err.message }) };
    }
};
