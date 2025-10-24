const { getSupabase } = require("../../shared_utils/supabase");

const SUBMITTED_PAYMENTS_TABLE = "SubmittedPayments";

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const REGION = process.env.AWS_REGION;

const FIELDS = ["member_id", "payment_id", "assigned_on", "submitted_on", "overdue", "total_paid"];

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
    
    try{

        const parameters = event.headers;
        const payload = {};

        for(const field of FIELDS){
            if(field in parameters){
                payload[field] = parameters[field];
            }
        }
        
        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        const response = (Object.keys(payload).length === 0) ? 
            await supabase.from(SUBMITTED_PAYMENTS_TABLE).select('*') : 
            await supabase.from(SUBMITTED_PAYMENTS_TABLE).select('*').match(payload);
        
        if(response.error){
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: response.error })
            }; 
        }

        return{
            statusCode : 200,
            headers : {"Content-Type" : "application/json"},
            body : JSON.stringify({
                data: response.data
            })
        };

    }catch(err){
        return{
            statusCode : 500,
            headers : {"Content-Type" : "application/json"},
            body : JSON.stringify({ error : err.message })
        };
    }
}