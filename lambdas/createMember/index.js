const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  // hello world!
  try {
    const data = JSON.parse(event.body);

    const params = {
      TableName: "sdkb",
      Item: {
        member_type: data.member_type,
        member_id: data.member_id,
        first_name: data.first_name,
        last_name: data.last_name,
        rank_number: data.rank_number,
        rank_type: data.rank_type
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
