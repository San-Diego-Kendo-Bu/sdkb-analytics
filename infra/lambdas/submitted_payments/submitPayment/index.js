const { getCurrentTimeUTC } = require("../../shared_utils/dates");
const { verifyMemberExists } = require("../../shared_utils/members.js");
const { getSupabase } = require("../../shared_utils/supabase");

const PAYMENTS_TABLE = "Payments";
const ASSIGNED_PAYMENTS_TABLE = "AssignedPayments";

const REQUIRED_FIELDS = ["member_id", "payment_id"];

const SUBMITTED_TABLE = "SubmittedPayments";

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
        // Get Member Id from DynamoDB
        const parameters = JSON.parse(event.body);
        const ids = {};

        for(const field of REQUIRED_FIELDS){
            if(!parameters[field]){
                return { 
                    statusCode: 400, 
                    body: `${field} is missing from your request, please include it.` 
                };
            }
            ids[field] = parameters[field];
        }
        
        const memberId = parseInt(ids['member_id']);
        const memberFound = await verifyMemberExists(memberId);
        if(!memberFound){
            return { statusCode: 400, body: "Invalid member ID." };
        }

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        
        // 1. Look up AssignedPayments w/ member ID + payment ID. If no entry is found, return
        // 2. Store: payment_id, assigned_on, status.
        const assignedPaymentResponse = 
            await supabase.from(ASSIGNED_PAYMENTS_TABLE)
            .select()
            .match(ids);
        if(assignedPaymentResponse.error){
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: response.error })
            }; 
        }

        const assignedEntry = assignedPaymentResponse.data[0];
        const paymentId = parseInt(assignedEntry.payment_id);
        const assignedOn = assignedEntry.assigned_on;
        const status = assignedEntry.status;

        // 3. Look up at Payments w/ payment_id.
        const paymentResponse = await supabase.from(PAYMENTS_TABLE).select().eq('payment_id', paymentId);
        if(paymentResponse.error){
            return{
                statusCode: 500,
                headers: { "Content-Type" : "application/json" },
                body: JSON.stringify( {error:paymentResponse.error} )
            };
        }

        const paymentEntry = paymentResponse.data[0];
        // 4. Store: payment_value, overdue_penalty.
        const paymentValue = (paymentEntry["payment_value"]) ? parseFloat(paymentEntry["payment_value"]) : 0.00;
        const overdue = (status === "overdue");
        const overdueValue = (paymentEntry["overdue_penalty"] && overdue) ? parseFloat(paymentEntry["overdue_penalty"]) : 0.00;
        const totalPaid = paymentValue + overdueValue;
        const submittedOn = parameters["submitted_on"] ? parameters["submitted_on"] : getCurrentTimeUTC();
        
        // 5. Create new Submission
        const payload = {
            payment_id : paymentId, 
            member_id : memberId, 
            assigned_on : assignedOn,
            submitted_on : submittedOn,
            overdue : overdue,
            total_paid : totalPaid
        }

        const response = await supabase.from(SUBMITTED_TABLE).insert(payload).select();
        if(response.error){
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: response.error })
            }; 
        }
        
        // 6. Delete entry from assigned table only if submitTable insertion (and operations prior) was successful
        const removeAssignedEntry = await supabase.from(ASSIGNED_PAYMENTS_TABLE)
            .delete()
            .match(ids);
        if(removeAssignedEntry.error){
            return{
                statusCode: 500,
                headers: {"Content-Type" : "application/json"},
                body: JSON.stringify({error : removeAssignedEntry.error})
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