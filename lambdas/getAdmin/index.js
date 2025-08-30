const { DynamoDBClient } = require ("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require ("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const ADMIN_TABLE = "admins";

const makeLowerCase = inputString => (inputString ?? "").toString().trim().toLowerCase();
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
  const auth = event.requestContext?.authorizer || {};
  const claims = auth.claims || (auth.jwt && auth.jwt.claims) || {};
  const emailFromClaims = makeLowerCase(claims.email);
  let email = emailFromClaims;
  if (!email) return deny("No email claim. Ensure you sent the ID token and requested 'email' scope.");
  
  try {
    const command = new GetCommand({ TableName: ADMIN_TABLE, Key: { email } });
    const result = await ddb.send(command);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        message: "Retrieved matching admins",
        item: result.Item ?? null,
        isAdmin: result.Item ? true : false
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