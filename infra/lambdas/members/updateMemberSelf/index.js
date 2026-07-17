const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const MEMBERS_TABLE = "members";

// Fields a member is allowed to update on themselves
const ALLOWED_FIELDS = new Set(['birthday', 'auskf_number']);

exports.handler = async (event) => {
  const claims = event.requestContext?.authorizer?.jwt?.claims ?? {};
  const username = claims['cognito:username'] ?? claims['preferred_username'];

  if (!username) {
    return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Unauthorized' }) };
  }

  try {
    const body = JSON.parse(event.body ?? '{}');

    const updates = Object.fromEntries(
      Object.entries(body).filter(([k]) => ALLOWED_FIELDS.has(k))
    );

    if (Object.keys(updates).length === 0) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'No valid fields to update.' }) };
    }

    const queryResult = await ddb.send(new QueryCommand({
      TableName: MEMBERS_TABLE,
      IndexName: 'username-index',
      KeyConditionExpression: '#u = :u',
      ExpressionAttributeNames: { '#u': 'username' },
      ExpressionAttributeValues: { ':u': username },
      Limit: 1,
    }));

    const memberId = queryResult.Items?.[0]?.member_id;
    if (!memberId) {
      return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Member not found.' }) };
    }

    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    for (const [key, value] of Object.entries(updates)) {
      updateExpressions.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = value;
    }

    await ddb.send(new UpdateCommand({
      TableName: MEMBERS_TABLE,
      Key: { member_id: memberId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Updated successfully.' }),
    };
  } catch (err) {
    console.error('updateMemberSelf error:', err);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Update failed', error: err.message }) };
  }
};
