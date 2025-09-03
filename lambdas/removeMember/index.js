const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  DeleteCommand
} = require("@aws-sdk/lib-dynamodb");

const MEMBERS_TABLE = "members";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

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

    const params = {
      TableName: MEMBERS_TABLE,
      Key: {
        member_id: data.member_id
      }
    };

    await ddb.send(new DeleteCommand(params));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Member deleted successfully.",
        deletedKey: params.Key
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
