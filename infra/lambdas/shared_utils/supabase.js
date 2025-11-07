const { createClient } = require("@supabase/supabase-js");
const ENDPOINT = 'https://gsriiicvvxzvidaakctw.supabase.co';

const { GetSecretValueCommand, SecretsManagerClient } = require("@aws-sdk/client-secrets-manager");


async function getSupabase(supabaseSecretId, region_in){
    const secrets_client = new SecretsManagerClient({ region: region_in });
    const r = await secrets_client.send(new GetSecretValueCommand({ SecretId: supabaseSecretId }));
    const raw = r.SecretString ?? Buffer.from(r.SecretBinary || "", "base64").toString("utf8");
    const obj = JSON.parse(raw); 
    const api_key = obj.SUPABASE_SECRET_KEY;
    const supabase = createClient(ENDPOINT, api_key);
    return supabase;
}

async function getFromTable(TABLE, FIELDS, parameters, supabase){
    const payload = {};

    for(const field of FIELDS){
        if(field in parameters){
            payload[field] = parameters[field];
        }
    }

    const response = (Object.keys(payload).length === 0) ?
        await supabase.from(TABLE).select('*') :
        await supabase.from(TABLE).select('*').match(payload);
    
    if(response.error){
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: response.error })
        }; 
    }

    return {
        statusCode : 200,
        headers : {"Content-Type" : "application/json"},
        body : JSON.stringify({
            message: 'Data retrieved successfully',
            length : response.data.length,
            data: response.data
        })
    };
}

module.exports = { getSupabase, getFromTable };