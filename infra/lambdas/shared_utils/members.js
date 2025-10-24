const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
    QueryCommand,
    DynamoDBDocumentClient
} = require("@aws-sdk/lib-dynamodb");

const REGION = process.env.AWS_REGION;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region : REGION }));
const MEMBERS_TABLE  = "members";
const MEMBER_ID_ATTR = "member_id";

async function verifyMemberExists(memberId) {
    let lastKey;
    const response = await ddb.send(new QueryCommand({
        TableName: MEMBERS_TABLE,
        KeyConditionExpression: "#e = :e",
        ExpressionAttributeNames:  { "#e": MEMBER_ID_ATTR },
        ExpressionAttributeValues: { ":e": memberId },
    }));

    if(response.Items.length === 0)
        return false;

  return true;
}

module.exports = { verifyMemberExists };