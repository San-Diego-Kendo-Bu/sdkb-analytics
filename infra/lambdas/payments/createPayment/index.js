const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient, UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const { getCurrentTimeUTC } = require("../../shared_utils/dates");
const { getSupabase } = require("../../shared_utils/supabase");

const PAYMENTS_TABLE = "Payments";
const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
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
            Key: { type: "paymentIdCounter" },
            UpdateExpression: "ADD #counter :val",
            ExpressionAttributeNames: { "#counter": "idCounter" },
            ExpressionAttributeValues: { ":val": 1 },
            ReturnValues: "ALL_NEW",
        };
        const updateResult = await ddb.send(new UpdateCommand(updateParams));
        const newPaymentId = updateResult.Attributes.idCounter;

        const parameters = JSON.parse(event.body);

        const title = parameters.title;
        const createdAt = parameters.created_at ? parameters.created_at : getCurrentTimeUTC();
        const dueDate = parameters.due_date;
        const paymentValue = parameters.payment_value ? parseFloat(parameters.payment_value) : null;
        const overduePenalty = parameters.overdue_penalty ? parseFloat(parameters.overdue_penalty) : 0.0;
        
        if(!paymentValue || paymentValue < 1.0){
            return{
                statusCode: 400,
                message: "Invalid payment value. Please create a payment of at least $1.00.",
                body: JSON.stringify({
                    message: "Please create a payment of at least $1.00.",
                    payment_value : paymentValue
                })
            };
        }

        if(overduePenalty < 0.0){
            return{
                statusCode: 400,
                message: "Invalid overdue penalty value. Please create a penalty of at least $0.00.",
                body: JSON.stringify({
                    message: "Please create a penalty of at least $0.00.",
                    payment_value : overduePenalty
                })
            };
        }

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);

        const response = await supabase.from(PAYMENTS_TABLE).insert({
            payment_id: newPaymentId,
            title: title,
            created_at: createdAt,
            due_date: dueDate,
            payment_value: paymentValue,
            overdue_penalty: overduePenalty,
        }).select();
        
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
                message: "Created Payment Successfully",
                id: data.payment_id,
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