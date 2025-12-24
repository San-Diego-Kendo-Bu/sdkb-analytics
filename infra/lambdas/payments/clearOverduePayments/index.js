const { getSupabase } = require("../../shared_utils/supabase");

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const REGION = process.env.AWS_REGION;
const PAYMENTS_TABLE = "Payments";

exports.handler = async (event) => {

    try {
        
        const parameters = JSON.parse(event.body);

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);

        const response = await supabase.from(PAYMENTS_TABLE)
            .delete()
            .eq('payment_value', 1)
            .select();        
        
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

    } catch (err) {
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};