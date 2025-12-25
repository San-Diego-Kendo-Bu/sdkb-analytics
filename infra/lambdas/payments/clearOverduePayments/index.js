const { getCurrentTimeUTC } = require("../../shared_utils/dates");
const { getSupabase, callPostgresFunction } = require("../../shared_utils/supabase");

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const REGION = process.env.AWS_REGION;

exports.handler = async () => {

    try {
        
        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        const currentTime = getCurrentTimeUTC();
        
        console.log("Current time UTC: " + currentTime);
        
        const args = {
            p_current_date : currentTime
        };

        const response =  await callPostgresFunction('clear_overdue_payments', args, supabase);
        
        console.log("REPORTING...");
        console.log(response);
        return response;

    } catch (err) {
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};