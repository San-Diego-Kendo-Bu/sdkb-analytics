const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");

// Init DynamoDB
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const MEMBERS_TABLE = "members";
const DEDUP_INDEX   = "dedup_key-index";
const ADMIN_TABLE = "admins";

const lc = v => (v ?? "").toString().trim().toLowerCase();

const deny = (msg="Forbidden") => ({
  statusCode: 403,
  headers: {
    "Content-Type": "text/plain",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
  },
  body: msg
});

exports.handler = async (event) => {
  // Prefer claims from API Gateway authorizer (ID token path)
  const auth = event.requestContext?.authorizer || {};
  const claims = auth.claims || (auth.jwt && auth.jwt.claims) || {};
  const emailFromClaims = lc(claims.email);

  let email = emailFromClaims;

  if (!email) return deny("No email claim. Ensure you sent the ID token and requested 'email' scope.");
  
  const { Item } = await ddb.send(new GetCommand({ TableName: ADMIN_TABLE, Key: { email } }));
  if (!Item) return deny("Admin only");

  try { 
    const data = JSON.parse(event.body);
    const { member_id, ...fieldsToUpdate } = data;

    if (Object.keys(data).length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing body data." })
      };
    }

    const dedupKey = [
      lc(data.first_name),
      lc(data.last_name),
      lc(data.rank_type),
      (data.rank_number ?? "").toString().trim(),
      (data.zekken_text ?? "").toString().trim(),
      lc(data.email)
    ].join("#");

    // check if new update results in a duplicate member
    const query = new QueryCommand({
      TableName: MEMBERS_TABLE,
      IndexName: DEDUP_INDEX,
      KeyConditionExpression: 'dedup_key = :dedupKey',
      ExpressionAttributeValues: {
        ':dedupKey': dedupKey
      }
    });

    const query_result = await ddb.send(query);

    // check for other member_id entries with the same fields
    const duplicates = (query_result.Items || []).filter(it => it.member_id !== member_id);

    if (duplicates.length > 0) {
      console.warn(`Duplicate member detected: ${dedupKey}. Skipping update.`);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Duplicate detected. Update skipped." })
      };
    }

    // Build UpdateExpression dynamically
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    for (const [key, value] of Object.entries(data)) {
      if (key != "member_id" && key != "dedup_key") {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    }

    // add derived fields
    updateExpressions.push("#dedup_key = :dedup_key");
    expressionAttributeNames["#dedup_key"] = "dedup_key";
    expressionAttributeValues[":dedup_key"] = dedupKey;

    const updateCommand = new UpdateCommand({
      TableName: MEMBERS_TABLE,
      Key: {
        member_id,
      },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW"
    });

    const result = await ddb.send(updateCommand);
 
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Member updated successfully.",
        updatedItem: result.Attributes
      })
    };
  } catch (err) {
    console.error("Update failed:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Update failed", error: err.message })
    };
  }
};
