const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  DeleteCommand
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  // konbanwa!
  try {
    const data = JSON.parse(event.body);

    const params = {
      TableName: "sdkb",
      Key: {
        member_type: data.member_type,
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
