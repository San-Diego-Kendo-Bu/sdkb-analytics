const { getSupabase } = require("../../shared_utils/supabase");

const SUBMITTED_PAYMENTS_TABLE = "SubmittedPayments";

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const REGION = process.env.AWS_REGION;

const FILTERS = ["member_id", "payment_id", "assigned_on", "submitted_on", "overdue", "total_paid"];

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

        const parameters = JSON.parse(event.body);
        const payload = {};

        for(const field of FILTERS){
            if(parameters[field]){
                payload[field] = parameters[field];
            }
        }
        
        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        
        let response;
        if(Object.keys(payload).length == 0){   // No filters were given, clear entire table
            response = await supabase.from(SUBMITTED_PAYMENTS_TABLE)
            .delete()
            .neq('payment_id', -1)              // ASSUMPTION: no payment will ever have a negative ID
            .select();
        }else{  // Remove entries with requested filters
            response = await supabase.from(SUBMITTED_PAYMENTS_TABLE)
            .delete()
            .match(payload)
            .select();
        }
        
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
                data: response.data,
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