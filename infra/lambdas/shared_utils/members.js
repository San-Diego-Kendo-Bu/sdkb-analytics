const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
    QueryCommand,
    DynamoDBDocumentClient
} = require("@aws-sdk/lib-dynamodb");

const REGION = process.env.AWS_REGION;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region : REGION }));
const MEMBERS_TABLE  = "members";

async function verifyMemberExists(memberId) {
    const params = {
        TableName: MEMBERS_TABLE,
        KeyConditionExpression: "member_id = :m_id",
        ExpressionAttributeValues: {
            ":m_id": memberId
        }
    };
    const command = new QueryCommand(params);
    const response = await ddb.send(command);
    return response.Items && response.Items.length > 0;
}

module.exports = { verifyMemberExists };