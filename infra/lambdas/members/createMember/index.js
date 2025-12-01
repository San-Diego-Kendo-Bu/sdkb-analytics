const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient, QueryCommand, PutCommand, UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

const Stripe = require("stripe");
const cognito = new CognitoIdentityProviderClient({ region: "us-east-2" });
const USER_POOL_ID = "us-east-2_pOKlRyKnT"

const REGION = process.env.AWS_REGION;
const SECRET_ID = process.env.SECRET_ID;
const MEMBERS_TABLE = "appConfigs";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const secrets_client = new SecretsManagerClient({ region: REGION });

const lc = (v) => (v ?? "").toString().trim().toLowerCase();

function normalizeGroups(raw) {
  if (Array.isArray(raw)) return raw.flatMap(normalizeGroups);
  const s = String(raw ?? "").trim();
  const withoutBrackets = s.startsWith("[") && s.endsWith("]") ? s.slice(1, -1) : s;
  return withoutBrackets.split(",").map((x) => x.trim()).filter(Boolean);
}

async function getStripe() {
  const r = await secrets_client.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  const raw = r.SecretString ?? Buffer.from(r.SecretBinary || "", "base64").toString("utf8");
  const obj = JSON.parse(raw);
  const api_key = obj.STRIPE_TEST_SECRET_KEY;
  return new Stripe(api_key); // optionally add { apiVersion: '2024-06-20' }
}

async function createCustomer(stripe, email, name, memberId) {
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { member_id: String(memberId) },
  });
  return customer.id;
}

exports.handler = async (event) => {
  const claims =
    event.requestContext?.authorizer?.jwt?.claims ??
    event.requestContext?.authorizer?.claims ?? {};

  const groups = normalizeGroups(claims["cognito:groups"]);
  const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
  if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

  try {
    // Increment the idCounter in the appConfigs table
    const updateParams = {
      TableName: MEMBERS_TABLE,
      Key: { type: "idCounter" },
      UpdateExpression: "ADD #counter :val",
      ExpressionAttributeNames: { "#counter": "idCounter" },
      ExpressionAttributeValues: { ":val": 1 },
      ReturnValues: "ALL_NEW",
    };
    const updateResult = await ddb.send(new UpdateCommand(updateParams));
    const newMemberId = updateResult.Attributes.idCounter;

    const data = JSON.parse(event.body ?? "{}");

    const dedupKey = [
      lc(data.first_name),
      lc(data.last_name),
      lc(data.rank_type),
      (data.rank_number ?? "").toString().trim(),
      (data.zekken_text ?? "").toString().trim(),
      lc(data.email),
    ].join("#");

    // dedupe
    const query = new QueryCommand({
      TableName: "members",
      IndexName: "dedup_key-index",
      KeyConditionExpression: "dedup_key = :dedupKey",
      ExpressionAttributeValues: { ":dedupKey": dedupKey },
    });
    const query_result = await ddb.send(query);
    const duplicates = (query_result.Items ?? []).filter((it) => it.member_id !== newMemberId);
    if (duplicates.length > 0) {
      console.warn(`Duplicate member detected: ${dedupKey}. Skipping insert.`);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Duplicate detected. Insert skipped." }),
      };
    }

    // create username 
    let username = lc(data.first_name).slice(0, 3) + newMemberId;

    // TODO: create cognito user with username 
    const cmd = new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,            // 👈 your generated username
      TemporaryPassword: "321Changemenow!", // must meet password policy
      UserAttributes: [
        { Name: "email", Value: lc(data.email) },
        { Name: "email_verified", Value: "true" }, // optional
        // optional, but nice to store:
        { Name: "preferred_username", Value: username },
      ],
    });

    const res = await cognito.send(cmd);
    console.log("Cognito user created:", res);

    // status + stripe
    const defaultStatus =
      String(data.is_guest ?? "").toLowerCase() === "yes"
        ? "guest"
        : data.rank_type === "dan" && Number(data.rank_number) >= 4
          ? "exempt"
          : "active";

    const stripe = await getStripe();
    const customer_id = await createCustomer(
      stripe,
      data.email,
      `${data.first_name} ${data.last_name}`,
      newMemberId
    );

    console.log("create username:", username);
    // write member
    const params = {
      TableName: "members",
      Item: {
        member_id: newMemberId,
        first_name: data.first_name,
        last_name: data.last_name,
        zekken_text: data.zekken_text,
        rank_number: data.rank_number,
        rank_type: data.rank_type,
        email: data.email,
        birthday: data.birthday ?? null,
        status: defaultStatus,
        customer_id, // fixed typo
        username,
        dedup_key: dedupKey,
      },
    };
    await ddb.send(new PutCommand(params));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Success", received: params.Item }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message ?? String(err) }),
    };
  }
};
