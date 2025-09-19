const { createClient } = require("@supabase/supabase-js");
const ENDPOINT = 'https://gsriiicvvxzvidaakctw.supabase.co';
const PAYMENTS_TABLE = "Payments";

const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const REGION = process.env.AWS_REGION;
const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const secrets_client = new SecretsManagerClient({ region: REGION });

function dummyCognito(){
    return ['admin@gmail.com'];
}

function isAdmin(clientEmail){
    return dummyCognito()[0] === clientEmail;
}

let cachedSupabase;
async function getSupabase(){
    if(cachedSupabase) return cachedSupabase;

    const r = await secrets_client.send(new GetSecretValueCommand({ SecretId: SUPABASE_SECRET_ID }));
    const raw = r.SecretString ?? Buffer.from(r.SecretBinary || "", "base64").toString("utf8");
    const obj = JSON.parse(raw); 
    const api_key = obj.SUPABASE_SECRET_KEY;
    cachedSupabase = createClient(ENDPOINT, api_key);
    return cachedSupabase;
}

exports.handler = async (event) => {

    const clientEmail = event.headers["client_email"];
    
    if(!isAdmin(clientEmail))
        return { statusCode: 403, body: "Forbidden" };

    try {
        
        const parameters = JSON.parse(event.body);
        const paymentId = parameters.payment_id;

        if(!paymentId){
            return{
                status: 400,
                message: "Please specify a payment id"
            }
        }
        const payload = {};
        if(parameters.title !== undefined) payload.title = parameters.title;
        if(parameters.created_at !== undefined) payload.created_at = parameters.created_at;
        if(parameters.due_date !== undefined) payload.due_date = parameters.due_date;
        if(parameters.payment_value !== undefined) payload.payment_value = parameters.payment_value;
        if(parameters.overdue_penalty !== undefined) payload.overdue_penalty = parameters.overdue_penalty;
        if(parameters.event_id !== undefined) payload.event_id = parameters.event_id;
        
        if(payload.payment_value && parseFloat(payload.payment_value) < 1.0){
            return{
                statusCode: 400,
                message: "Invalid payment value. Please update payment to at least $1.00.",
                body: JSON.stringify({
                    message: " Please update payment to at least $1.00.",
                    payment_value : payload.payment_value
                })
            };
        }

        if(payload.overdue_penalty && parseFloat(payload.overdue_penalty) < 0.0){
            return{
                statusCode: 400,
                message: "Invalid overdue value. Please update overdue value to at least $0.00.",
                body: JSON.stringify({
                    message: "Please update overdue value to at least $0.00.",
                    payment_value : payload.overdue_penalty
                })
            };
        }

        const supabase = await getSupabase();
        const response = await supabase.from(PAYMENTS_TABLE)
            .update(payload)
            .eq('payment_id', paymentId);

        if(response.error){
            return{
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: response.error }),
            };
        }
        
        return{
            statusCode : 200,
            headers : {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body : JSON.stringify({
                message: "Updated Payment Successfully",
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