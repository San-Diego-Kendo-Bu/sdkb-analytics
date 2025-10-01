const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  DeleteCommand,
  QueryCommand
} = require("@aws-sdk/lib-dynamodb");

const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const Stripe = require("stripe");

const MEMBERS_TABLE = "members";
const REGION = process.env.AWS_REGION;
const SECRET_ID = process.env.SECRET_ID;
const MEMBER_ID_ATTR = "member_id";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const secrets_client = new SecretsManagerClient({ region: REGION });

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

async function getStripe() {
  const r = await secrets_client.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  const raw = r.SecretString ?? Buffer.from(r.SecretBinary || "", "base64").toString("utf8");
  const obj = JSON.parse(raw); 
  const api_key = obj.STRIPE_TEST_SECRET_KEY;
  return new Stripe(api_key);
}

async function deleteCustomer(stripeClient, customerId) {
  console.log("Deleting customer:", customerId);
  try {
    // if there are any subscriptions
    const subs = await stripeClient.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
    for (const s of subs.data) {
      console.log("Canceling subscription:", s.id);
      await stripeClient.subscriptions.cancel(s.id);
    }

    // if any payment methods
    const pms = await stripeClient.paymentMethods.list({ customer: customerId, type: 'card' });
    for (const pm of pms.data) {
      console.log("Detaching payment method:", pm.id);
      await stripeClient.paymentMethods.detach(pm.id);
    }

    const deleted = await stripeClient.customers.del(customerId); 
    console.log("Deleted customer:", deleted);
    return deleted;

  } catch (err) {
    console.error("Stripe delete error:",
      err?.message,
      "| type:", err?.type,
      "| code:", err?.code,
      "| raw:", err?.raw?.message
    );
    throw err;
  }
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

    const stripe = await getStripe();
    const responseItems = [];
    let lastKey;
    do {
      const response = await ddb.send(new QueryCommand({
        TableName: MEMBERS_TABLE,
        KeyConditionExpression: "#e = :e",
        ExpressionAttributeNames:  { "#e": MEMBER_ID_ATTR },
        ExpressionAttributeValues: { ":e": data.member_id },
        ExclusiveStartKey: lastKey,
      }));
      responseItems.push(...(response.Items || []));
      lastKey = response.LastEvaluatedKey;
    } while (lastKey);

    const customer_id = responseItems[0]["customer_id"];
    await deleteCustomer(stripe, customer_id);

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
