const { getSupabase } = require("../../shared_utils/supabase");
const { verifyMemberExists } = require("../../shared_utils/members");
const { getCurrentTimeUTC } = require("../../shared_utils/dates");

const ASSIGN_DATE_ATTR = "assigned_on";

const PAYMENTS_TABLE = "Payments";
const PAYMENT_ID_ATTR = "payment_id";
const ASSIGNED_PAYMENTS_TABLE = "AssignedPayments";

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const REGION = process.env.AWS_REGION;

const MEMBER_ID_ATTR = "member_id";
const REQUIRED_FIELDS = ["member_id", "payment_id", "status"];

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
        // Get Member Id from DynamoDB
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
        payload[ASSIGN_DATE_ATTR] = parameters[ASSIGN_DATE_ATTR] ? parameters[ASSIGN_DATE_ATTR] : getCurrentTimeUTC();

        const memberId = parseInt(payload[MEMBER_ID_ATTR]);
        const paymentId = parseInt(payload[PAYMENT_ID_ATTR]);

        const memberFound = await verifyMemberExists(memberId);
        if(!memberFound){
            return { statusCode: 400, body: "Invalid member ID." };
        }

        // Get Payment Id from Supabase
        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        const payment = await supabase.from(PAYMENTS_TABLE).select('*').eq(PAYMENT_ID_ATTR, paymentId);
        if(Object.keys(payment.data).length == 0){
            return { statusCode: 400, body: "Invalid payment ID." };
        }

        // Create new AssignedPayment with member_id, payment_id, assigned_on, status
        const response = await supabase.from(ASSIGNED_PAYMENTS_TABLE).insert(payload).select();
        
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
            headers : {"Content-Type" : "application/json"},
            body : JSON.stringify({
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