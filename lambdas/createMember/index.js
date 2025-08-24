const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const lc = v => (v ?? "").toString().trim().toLowerCase();

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
        status: "active",
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
