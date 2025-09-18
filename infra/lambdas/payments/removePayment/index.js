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

        const supabase = await getSupabase();
        const response = await supabase.from(PAYMENTS_TABLE).delete().eq('payment_id', paymentId);

        if(response.error){
            return{
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
                message: "Deleted Payment Successfully",
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