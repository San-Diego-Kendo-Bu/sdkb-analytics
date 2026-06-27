const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { getMemberById, getMembersByEmail } = require("../../shared_utils/members");
const {
  ScanCommand,
  QueryCommand,
  DynamoDBDocumentClient
} = require("@aws-sdk/lib-dynamodb");

const DEFAULT_GET_RESPONSE_HEADERS = { "Content-Type": "application/json" };

// Initialize SDK v3 client
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const MEMBERS_TABLE  = "members";

exports.handler = async (event) => {
  try {
    
    if (event.queryStringParameters) {
      if (event.queryStringParameters.email) {
        let email = event.queryStringParameters.email;
        return await getByEmail(email);
      } else if (event.queryStringParameters.member_id) {
        let member_id = parseInt(event.queryStringParameters.member_id);
        return await getById(member_id);
      } else if (event.queryStringParameters.username) {
        return await getByUsername(event.queryStringParameters.username);
      } else {
        return {
          statusCode: 500,
          headers: DEFAULT_GET_RESPONSE_HEADERS,
          body: JSON.stringify({
            message: "Invalid query string: " + JSON.stringify(event.queryStringParameters),
          })
        };
      }
    } else {
      // Handle request with no query params; return all users 
      return await getAllMembers();
    }
  } catch (err) {
    console.error("Error while getting members: ", err);
    return {
      statusCode: 500,
      headers: DEFAULT_GET_RESPONSE_HEADERS,
      body: JSON.stringify({
        message: "Failed to retrieve members",
        error: err.message
      })
    };
  }
};

async function getByEmail(email) {
  const responseItems = await getMembersByEmail(email);

  return { 
    statusCode: 200, 
    headers: DEFAULT_GET_RESPONSE_HEADERS,
    body: JSON.stringify({ 
      count: responseItems.length,
      items: responseItems
    }),
  };
}

async function getById(memberId) {
  const responseItems = await getMemberById(memberId);

  return { 
    statusCode: 200, 
    headers: DEFAULT_GET_RESPONSE_HEADERS,
    body: JSON.stringify({
      count: responseItems.length,
      items: responseItems
    }),
  };
}

async function getByUsername(username) {
  const response = await ddb.send(new QueryCommand({
    TableName: MEMBERS_TABLE,
    IndexName: "username-index",
    KeyConditionExpression: "#u = :u",
    ExpressionAttributeNames: { "#u": "username" },
    ExpressionAttributeValues: { ":u": username },
    Limit: 1,
  }));
  const items = response.Items ?? [];
  return {
    statusCode: 200,
    headers: DEFAULT_GET_RESPONSE_HEADERS,
    body: JSON.stringify({ count: items.length, items }),
  };
}

async function getAllMembers() {
  const command = new ScanCommand({ TableName: MEMBERS_TABLE });
  const result = await ddb.send(command);

  return {
    statusCode: 200,
    headers: {
      ...DEFAULT_GET_RESPONSE_HEADERS,
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify({
      message: "Retrieved all members",
      count: result.Items.length,
      items: result.Items
    })
  };
}
