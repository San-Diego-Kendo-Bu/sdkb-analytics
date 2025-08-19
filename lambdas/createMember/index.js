const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
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
    const dedupKey = `${data.first_name.toLowerCase()}#${data.last_name.toLowerCase()}#${data.rank_type.toLowerCase()}#${data.rank_number}#${data.zekken_text}`;

    const query = new QueryCommand({
      TableName: 'members',
      IndexName: 'dedup_key-index',
      KeyConditionExpression: 'dedup_key = :dedupKey',
      ExpressionAttributeValues: {
        ':dedupKey': dedupKey
      }
    });

    const result = await ddb.send(query);

    if (result.Count > 0) {
      console.warn(`Duplicate member detected: ${dedupKey}. Skipping insert.`);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Duplicate detected. Insert skipped." })
      };
    }

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
