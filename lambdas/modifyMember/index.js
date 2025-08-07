const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");

// Init DynamoDB
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log("Lambda invoked");
  try { 
    const data = JSON.parse(event.body);
    const { member_id, ...fieldsToUpdate } = data;

    if (Object.keys(data).length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing body data." })
      };
    }

    const dedupKey = `${data.first_name.toLowerCase()}#${data.last_name.toLowerCase()}#${data.rank_type.toLowerCase()}#${data.rank_number}#${data.zekken_text}`;

    // check if new update results in a duplicate member
    const query = new QueryCommand({
      TableName: 'members',
      IndexName: 'dedup_key-index',
      KeyConditionExpression: 'dedup_key = :dedupKey',
      ExpressionAttributeValues: {
        ':dedupKey': dedupKey
      }
    });

    const query_result = await ddb.send(query);

    if (query_result.Count > 0) {
      console.warn(`Duplicate member detected: ${dedupKey}. Skipping update.`);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Duplicate detected. Update skipped." })
      };
    }

    // Build UpdateExpression dynamically
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    for (const [key, value] of Object.entries(data)) {
      if (key != "member_id") {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    }

    const updateCommand = new UpdateCommand({
      TableName: "members",
      Key: {
        member_id,
      },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW"
    });

    const result = await ddb.send(updateCommand);
 
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Member updated successfully.",
        updatedItem: result.Attributes
      })
    };
  } catch (err) {
    console.error("Update failed:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Update failed", error: err.message })
    };
  }
};
