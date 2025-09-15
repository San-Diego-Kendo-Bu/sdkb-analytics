const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
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
const EMAIL_INDEX    = "email-index";
const EMAIL_ATTR     = "email";
const MEMBER_ID_ATTR = "member_id";

exports.handler = async (event) => {
  try {
    if (event.queryStringParameters) {
      if (event.queryStringParameters.email) {
        // Handle query by email address
        let email = event.queryStringParameters.email;
        return await getMembersByEmail(email);
      } else if (event.queryStringParameters.member_id) {
        // Handle query by member ID 
        let member_id = parseInt(event.queryStringParameters.member_id);
        return await getMemberByMemberId(member_id);
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

async function getMembersByEmail(email) {
  // NOTE: GSI index lookups are eventually consistent
  const responseItems = [];
  let lastKey;
  do {
    const response = await ddb.send(new QueryCommand({
      TableName: MEMBERS_TABLE,
      IndexName: EMAIL_INDEX,
      KeyConditionExpression: "#e = :e",
      ExpressionAttributeNames:  { "#e": EMAIL_ATTR },
      ExpressionAttributeValues: { ":e": email },
      ExclusiveStartKey: lastKey,
    }));
    responseItems.push(...(response.Items || []));
    lastKey = response.LastEvaluatedKey;
  } while (lastKey);

  return { 
    statusCode: 200, 
    headers: DEFAULT_GET_RESPONSE_HEADERS,
    body: JSON.stringify({ 
      count: responseItems.length,
      items: responseItems
    }),
  };
}

async function getMemberByMemberId(memberId) {
  const responseItems = [];
  let lastKey;
  do {
    const response = await ddb.send(new QueryCommand({
      TableName: MEMBERS_TABLE,
      KeyConditionExpression: "#e = :e",
      ExpressionAttributeNames:  { "#e": MEMBER_ID_ATTR },
      ExpressionAttributeValues: { ":e": memberId },
      ExclusiveStartKey: lastKey,
    }));
    responseItems.push(...(response.Items || []));
    lastKey = response.LastEvaluatedKey;
  } while (lastKey);

  return { 
    statusCode: 200, 
    headers: DEFAULT_GET_RESPONSE_HEADERS,
    body: JSON.stringify({ 
      count: responseItems.length,
      items: responseItems
    }),
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
