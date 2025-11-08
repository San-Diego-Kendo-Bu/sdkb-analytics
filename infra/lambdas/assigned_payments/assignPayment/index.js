const { getSupabase } = require("../../shared_utils/supabase");
const { verifyMemberExists } = require("../../shared_utils/members");
const { getCurrentTimeUTC } = require("../../shared_utils/dates");

const REQUIRED_FIELDS = ["member_id", "payment_id", "status"];

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const REGION = process.env.AWS_REGION;

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

        for(const field of REQUIRED_FIELDS){
            if(!parameters[field]){
                return { 
                    statusCode: 400, 
                    body: `${field} is missing from your request, please include it.` 
                };
            }
            payload[field] = parameters[field];
        }

        const memberId = parseInt(payload['member_id']);
        const memberFound = await verifyMemberExists(memberId);
        if(!memberFound){
            return { statusCode: 400, body: "Invalid member ID." };
        }

        payload["assigned_on"] = parameters["assigned_on"] ? parameters["assigned_on"] : getCurrentTimeUTC();

        // Get Payment Id from Supabase
        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);

        const response = await supabase.rpc('assign_payment',{
            p_member_id: payload.member_id,
            p_payment_id: payload.payment_id,
            p_assigned_on: payload.assigned_on,
            p_status: payload.status
        });

        if(response.error){
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: response.error })
            }; 
        }

        const data = response.data;
        return{
            statusCode : 200,
            headers : {"Content-Type" : "application/json"},
            body : JSON.stringify({
                function: 'supabase',
                payment_id: data.payment_id,
                member_id: data.member_id,
                data: data,
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