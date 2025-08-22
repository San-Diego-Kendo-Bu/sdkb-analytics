const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  QueryCommand,
  DynamoDBDocumentClient
} = require("@aws-sdk/lib-dynamodb");

// Initialize SDK v3 client
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const MEMBERS_TABLE = "members";
const EMAIL_INDEX   = "email-index";
const EMAIL_ATTR    = "email";

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    let email = (qs.email || "").trim();
    if (!email) 
        return respond(400, { error: "Missing ?email=..." });

    // NOTE: GSI index lookups are eventually consistent
    const items = [];
    let lastKey;
    do {
      const out = await ddb.send(new QueryCommand({
        TableName: MEMBERS_TABLE,
        IndexName: EMAIL_INDEX,
        KeyConditionExpression: "#e = :e",
        ExpressionAttributeNames:  { "#e": EMAIL_ATTR },
        ExpressionAttributeValues: { ":e": email },
        ExclusiveStartKey: lastKey,
      }));
      items.push(...(out.Items || []));
      lastKey = out.LastEvaluatedKey;
    } while (lastKey);

    // With KEYS_ONLY projection, each item includes the table PK (member_id) and the GSI key
    const results = items.map(({ member_id }) => ({ member_id }));

    return respond(200, { email, count: results.length, member_ids: results });
  } catch (err) {
    console.error(err);
    return respond(500, { error: err.message });
  }
};

function respond(statusCode, body) {
  return { 
    statusCode, 
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}