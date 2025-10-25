const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
    QueryCommand,
    DynamoDBDocumentClient
} = require("@aws-sdk/lib-dynamodb");

const REGION = process.env.AWS_REGION;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region : REGION }));

const MEMBER_ID_ATTR = "member_id";
const MEMBERS_TABLE  = "members";

const EMAIL_ATTR     = "email";
const EMAIL_INDEX    = "email-index";

async function getMemberById(memberId) {
  const responseItems = [];
  let lastKey;
  do {
    const response = await ddb.send(new QueryCommand({
      TableName: MEMBERS_TABLE,
      KeyConditionExpression: "#e = :e",
      ExpressionAttributeNames:  { "#e": MEMBER_ID_ATTR },
      ExpressionAttributeValues: { ":e": memberId }, 
      ExclusiveStartKey: lastKey,
    }));
    responseItems.push(...(response.Items || []));
    lastKey = response.LastEvaluatedKey;
  } while (lastKey);

  return responseItems;
}

async function getMembersByEmail(email) {
  // NOTE: GSI index lookups are eventually consistent
  const responseItems = [];
  let lastKey;
  do {
    const response = await ddb.send(new QueryCommand({
      TableName: MEMBERS_TABLE,
      IndexName: EMAIL_INDEX,
      KeyConditionExpression: "#e = :e",
      ExpressionAttributeNames:  { "#e": EMAIL_ATTR },
      ExpressionAttributeValues: { ":e": email },
      ExclusiveStartKey: lastKey,
    }));
    responseItems.push(...(response.Items || []));
    lastKey = response.LastEvaluatedKey;
  } while (lastKey);

  return responseItems;
}

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

module.exports = { getMemberById, getMembersByEmail, verifyMemberExists };
