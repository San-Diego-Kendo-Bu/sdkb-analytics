const { getSupabase, entryExistsByField, deleteByField} = require("../../shared_utils/supabase");

const PAYMENTS_TABLE = "Payments";
const ASSIGNED_PAYMENTS_TABLE = "AssignedPayments";
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

    try {
        
        const parameters = JSON.parse(event.body);
        const paymentId = parameters.payment_id;
        
        if(!paymentId){
            return{
                status: 400,
                message: "Please specify a payment id"
            }
        }

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        const exists = await entryExistsByField(ASSIGNED_PAYMENTS_TABLE, "payment_id", paymentId, supabase);
        
        if(exists){
            const deleted = await deleteByField(ASSIGNED_PAYMENTS_TABLE, "payment_id", paymentId, supabase);
            console.log(`Deleted ${deleted.length} rows for payment ${paymentId}`);
        } else {
            console.log(`No assigned payments found for payment_id: ${paymentId}`);
        }

        const response = await supabase.from(PAYMENTS_TABLE).delete().eq('payment_id', paymentId).select();

        if(response.error){
            return{
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: response.error })
            };
        }

        const data = response.data[0];
        return{
            statusCode : 200,
            headers : {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body : JSON.stringify({
                message: "Deleted Payment Successfully",
                id: data.payment_id,
                data: data,
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