const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

import Stripe from "stripe";

const REGION = process.env.AWS_REGION;  
const SECRET_ID = process.env.SECRET_ID;

const secrets_client = new SecretsManagerClient({
  region: REGION,
});

let response;

try {
  response = await secrets_client.send(
    new GetSecretValueCommand({
      SecretId: SECRET_ID,
      VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
    })
  );
} catch (error) {
  // For a list of exceptions thrown, see
  // https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
  throw error;
}

const stripe_api_key = response.SecretString; // as of 9/13 using test keys
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const stripe = new Stripe(stripe_api_key);

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

async function createCustomer(email, name, member_id_value) {
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { member_id: member_id_value }, // optional
  });

  console.log("✅ Customer created!");
  console.log("Customer ID:", customer.id); // e.g., cus_N7zYd9s123abc
  return customer.id;
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
    // Increment the idCounter in the appConfigs table
    const updateParams = {
      TableName: "appConfigs",
      Key: { type:"idCounter" },
      UpdateExpression: "ADD #counter :val",
      ExpressionAttributeNames: { "#counter": "idCounter" },
      ExpressionAttributeValues: {':val': 1},
      ReturnValues: "ALL_NEW"
    };
    const updateResult = await ddb.send(new UpdateCommand(updateParams));
    const newMemberId = updateResult.Attributes.idCounter;
    const data = JSON.parse(event.body);
    
    const dedupKey = [
      lc(data.first_name),
      lc(data.last_name),
      lc(data.rank_type),
      (data.rank_number ?? "").toString().trim(),
      (data.zekken_text ?? "").toString().trim(),
      lc(data.email)
    ].join("#");
    
    const query = new QueryCommand({
      TableName: 'members',
      IndexName: 'dedup_key-index',
      KeyConditionExpression: 'dedup_key = :dedupKey',
      ExpressionAttributeValues: {
        ':dedupKey': dedupKey
      }
    });

    const query_result = await ddb.send(query);

    // check for other member_id entries with the same fields
    const duplicates = (query_result.Items || []).filter(it => it.member_id !== newMemberId);

    if (duplicates.length > 0) {
      console.warn(`Duplicate member detected: ${dedupKey}. Skipping insert.`);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Duplicate detected. Insert skipped." })
      };
    }

    const defaultStatus = (data.is_guest.toLowerCase() == 'yes') ? "guest" : ((data.rank_type == "dan" && data.rank_number >= 4) ? "exempt" : "active");
    const new_customer_id = await createCustomer(data.email, data.first_name + " " + data.last_name, newMemberId);

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
        cusomter_id: new_customer_id,
        dedup_key: dedupKey,
      }
    };

    await ddb.send(new PutCommand(params));
    
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Success", received: params.Item })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
