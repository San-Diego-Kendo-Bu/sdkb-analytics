const { getSupabase, callPostgresFunction } = require("../../shared_utils/supabase");

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
        const args = { p_payment_id : paymentId };
        const response = callPostgresFunction('remove_payment', args, supabase);
        
        return response;

    } catch (err) {
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};