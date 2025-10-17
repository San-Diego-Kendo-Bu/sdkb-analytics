const { getSupabase } = require("../../shared_utils/supabase");

const PAYMENTS_TABLE = "Payments";
const PAYMENT_ID_ATTR = "payment_id";
const ASSIGNED_PAYMENTS_TABLE = "AssignedPayments";

const MEMBER_ID_ATTR = "member_id";
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

/**
 * There's a lot going on here. You probably wanna test this is parts.
 * 1. Look up AssignedPayments w/ member ID + payment ID. If no entry is found, return
 * 2. Store: payment_id, assigned_on, status.
 * 3. Delete entry from AssignedPayments
 * 4. Look up at Payments w/ payment_id.
 * 5. Store: payment_value, overdue_penalty.
 * 6. Create new Submission with { 
 *      payment_id : payment_id, 
 *      member_id : member_id, 
 *      assigned_on : assigned_on,
 *      submitted_on : current date,
 *      overdue : (status == "overdue"),
 *      total_paid : payment_value + overdue_penalty (if overdue == true)
 * }
 */
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

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        
        // 1. Look up AssignedPayments w/ member ID + payment ID. If no entry is found, return
        // 2. Store: payment_id, assigned_on, status.
        // 3. Delete entry from AssignedPayments
        const assignedPaymentResponse = 
            await supabase.from(ASSIGNED_PAYMENTS_TABLE)
            .delete()
            .match(ids)
            .select();
        
        const assignedEntry = assignedPaymentResponse.data[0];
        const paymentId = parseInt(assignedEntry["payment_id"]);
        const memberId = parseInt(assignedEntry["member_id"]);
        const assignedOn = assignedEntry["assigned_on"];
        const status = assignedEntry["status"];

        // 4. Look up at Payments w/ payment_id.
        const paymentResponse = await supabase.from(PAYMENTS_TABLE).eq('payment_id', paymentId).select('*');
        const paymentEntry = paymentResponse.data[0];
        // 5. Store: payment_value, overdue_penalty.
        const paymentValue = (paymentEntry["payment_value"]) ? parseFloat(paymentEntry["payment_value"]) : 0.00;
        const overdue = (status === "overdue"); // TODO: not sure if this is formatted correctly for payload...
        const overdueValue = (paymentEntry["overdue_penalty"] && overdue) ? parseFloat(paymentEntry["overdue_penalty"]) : 0.00;
        const totalPaid = paymentValue + overdueValue;
        const submittedOn = getTodayDate();
        
        // 6. Create new Submission
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

function getTodayDate(){
    const date = new Date();
    const year = date.getFullYear();
    const monthVal = date.getMonth() + 1;
    const dayVal = date.getDate();

    const monthString = monthVal < 10 ? '0' + monthVal : monthVal.toString(); 
    const dayString = dayVal < 10 ? '0' + dayVal : dayVal.toString();

    return `${year}-${monthString}-${dayString}`;
}