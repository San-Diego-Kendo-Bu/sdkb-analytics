const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");

// Init DynamoDB
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const MEMBERS_TABLE = "members";
const DEDUP_INDEX   = "dedup_key-index";

const lc = v => (v ?? "").toString().trim().toLowerCase();

function normalizeGroups(raw) {
  if (Array.isArray(raw)) {
    return raw.flatMap(item => normalizeGroups(item)); // handle nested / mixed shapes
  }
  const s = String(raw || '').trim();

  // If the value is like "[a, b, c]" (stringified array), strip brackets first
  const withoutBrackets = (s.startsWith('[') && s.endsWith(']')) ? s.slice(1, -1) : s;

  // Split by comma, trim entries, drop empties
  return withoutBrackets
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
}

exports.handler = async (event) => {
  // Prefer claims from API Gateway authorizer (ID token path)
  const claims =
    event.requestContext?.authorizer?.jwt?.claims ??
    event.requestContext?.authorizer?.claims ??
    {};

  const groups = normalizeGroups(claims['cognito:groups']);
  const isAdmin = groups.some(g => g === 'admins' || g.endsWith(' admins'));

  console.log('Auth debug', {
    email: claims.email,
    groups,
    token_use: claims.token_use,
  });

  if (!isAdmin) {
    return { statusCode: 403, body: 'Forbidden' };
  }

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
