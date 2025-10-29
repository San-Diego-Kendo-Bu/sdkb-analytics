const { getSupabase } = require("../../shared_utils/supabase");

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const SHINSA_REGISTRATION_TABLE = "ShinsaRegistrations";
const REGION = process.env.AWS_REGION;

const SHINSA_FIELDS = ["event_id", "member_id", "registered_date", "testing_for"];

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
        const parameters = event.headers;
        const payload = {};

        for(const field of SHINSA_FIELDS){
            if(field in parameters){
                payload[field] = parameters[field];
            }
        }

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        const response = (Object.keys(payload).length === 0) ?
            await supabase.from(SHINSA_REGISTRATION_TABLE).select("*") :
            await supabase.from(SHINSA_REGISTRATION_TABLE).select("*").match(payload);

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
                message: "Registration(s) retrieved successfully.",
                payload : payload,
                body: response.data,
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