const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const H = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

exports.handler = async () => {
    try {
        const result = await ddb.send(new GetCommand({
            TableName: "appConfigs",
            Key: { type: "nafudaOrder" },
        }));
        return {
            statusCode: 200,
            headers: H,
            body: JSON.stringify({ order: result.Item?.order ?? {} }),
        };
    } catch (err) {
        console.error("getNafudaOrder error:", err);
        return { statusCode: 500, headers: H, body: JSON.stringify({ error: err.message }) };
    }
};
