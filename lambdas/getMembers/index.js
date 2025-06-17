const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  ScanCommand,
  DynamoDBDocumentClient
} = require("@aws-sdk/lib-dynamodb");

// Initialize SDK v3 client
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    const command = new ScanCommand({ TableName: "sdkb" });
    const result = await ddb.send(command);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        message: "Retrieved all members",
        count: result.Items.length,
        items: result.Items
      })
    };
  } catch (err) {
    console.error("Scan error:", err);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Failed to retrieve members",
        error: err.message
      }) 
    };
  }
};
