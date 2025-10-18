const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient, UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const { getSupabase } = require("../../shared_utils/supabase");

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const EVENTS_TABLE = "Events";
const REGION = process.env.AWS_REGION;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

function dummyCognito(){
    return ['admin@gmail.com'];
}

function isAdmin(clientEmail){
    return dummyCognito()[0] === clientEmail;
}

exports.handler = async (event) => {

    const clientEmail = event.headers["client_email"];
    
    if(!isAdmin(clientEmail))
        return { statusCode: 403, body: "Forbidden" };

    try {
        const updateParams = {
            TableName: "appConfigs",
            Key: { type: "eventIdCounter" },
            UpdateExpression: "ADD #counter :val",
            ExpressionAttributeNames: { "#counter": "idCounter" },
            ExpressionAttributeValues: { ":val": 1 },
            ReturnValues: "ALL_NEW",
        };
        const updateResult = await ddb.send(new UpdateCommand(updateParams));
        const newEventId = updateResult.Attributes.idCounter;

        const parameters = JSON.parse(event.body);

        const eventName = parameters.event_name;
        const eventType = parameters.event_type;
        const createdAt = parameters.created_at;
        const eventDate = parameters.event_date;
        const eventDeadline = parameters.event_deadline;
        const eventLocation = parameters.event_location;

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);

        const response = await supabase.from(EVENTS_TABLE).insert({
            event_id: newEventId,
            event_date: eventDate,
            event_name: eventName,
            event_type: eventType,
            event_deadline: eventDeadline,
            created_at: createdAt,
            event_location: eventLocation
        });
        
        if(response.error){
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: response.error })
            }; 
        }

        const data = response.data[0];

        return{
            statusCode : 200,
            headers : {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body : JSON.stringify({
                message: "Created Event Successfully",
                id: data.event_id,
                data: data,
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