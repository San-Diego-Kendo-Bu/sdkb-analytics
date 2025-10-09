const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient, UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const { createClient } = require("@supabase/supabase-js");
const ENDPOINT = 'https://gsriiicvvxzvidaakctw.supabase.co';
const PAYMENTS_TABLE = "Payments";

const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const REGION = process.env.AWS_REGION;
const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const secrets_client = new SecretsManagerClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

function dummyCognito(){
    return ['admin@gmail.com'];
}

function isAdmin(clientEmail){
    return dummyCognito()[0] === clientEmail;
}

async function getSupabase(){
    const r = await secrets_client.send(new GetSecretValueCommand({ SecretId: SUPABASE_SECRET_ID }));
    const raw = r.SecretString ?? Buffer.from(r.SecretBinary || "", "base64").toString("utf8");
    const obj = JSON.parse(raw); 
    const api_key = obj.SUPABASE_SECRET_KEY;
    const cachedSupabase = createClient(ENDPOINT, api_key);
    return cachedSupabase;
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
        const createdAt = parameters.created_at;
        const dueDate = parameters.due_date;
        const paymentValue = parameters.payment_value ? parseFloat(parameters.payment_value) : null;
        const overduePenalty = parameters.overdue_penalty ? parseFloat(parameters.overdue_penalty) : null;
        
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

        if(overduePenalty && overduePenalty < 0.0){
            return{
                statusCode: 400,
                message: "Invalid overdue penalty value. Please create a penalty of at least $0.00.",
                body: JSON.stringify({
                    message: "Please create a penalty of at least $0.00.",
                    payment_value : overduePenalty
                })
            };
        }

        const supabase = await getSupabase();

        const response = await supabase.from(PAYMENTS_TABLE).insert({
            payment_id: newPaymentId,
            title: title,
            created_at: createdAt,
            due_date: dueDate,
            payment_value: paymentValue,
            overdue_penalty: overduePenalty,
        });
        
        if(response.error){
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: response.error })
            }; 
        }

        return{
            statusCode : 200,
            headers : {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body : JSON.stringify({
                message: "Created Payment Successfully",
                request_parameters: parameters,
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