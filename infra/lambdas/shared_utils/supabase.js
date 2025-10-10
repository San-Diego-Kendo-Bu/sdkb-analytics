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

module.exports = { getSupabase };