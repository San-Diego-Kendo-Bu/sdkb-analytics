const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  DeleteCommand
} = require("@aws-sdk/lib-dynamodb");

const ADMIN_TABLE = "admins";
const MEMBERS_TABLE = "members";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const lc = (v) => (v ?? "").toString().trim().toLowerCase();

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
