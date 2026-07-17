const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");
const { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand } = require("@aws-sdk/client-cognito-identity-provider");

const { normalizeGroups } = require("../../shared_utils/normalize_claim");

// Init DynamoDB
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const cognito = new CognitoIdentityProviderClient({ region: "us-east-2" });

const MEMBERS_TABLE = "members";
const DEDUP_INDEX = "dedup_key-index";
const USER_POOL_ID = "us-east-2_pOKlRyKnT";

const lc = v => (v ?? "").toString().trim().toLowerCase();

exports.handler = async (event) => {
  // Prefer claims from API Gateway authorizer (ID token path)
  const claims =
    event.requestContext?.authorizer?.jwt?.claims ??
    event.requestContext?.authorizer?.claims ??
    {};

  const groups = normalizeGroups(claims['cognito:groups']);
  const isAdmin = groups.some(g => g === 'admins' || g.endsWith(' admins'));

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

    // If email is changing, also update Cognito so password reset goes to the right address
    if (data.email) {
      try {
        const memberRecord = await ddb.send(new GetCommand({ TableName: MEMBERS_TABLE, Key: { member_id } }));
        const username = memberRecord.Item?.username;
        if (username) {
          await cognito.send(new AdminUpdateUserAttributesCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            UserAttributes: [
              { Name: "email", Value: data.email.trim() },
              { Name: "email_verified", Value: "true" },
            ],
          }));
        }
      } catch (cognitoErr) {
        console.error("Cognito email update failed:", cognitoErr);
      }
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
