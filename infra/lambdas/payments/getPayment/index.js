const { getSupabase, getFromTable } = require("../../shared_utils/supabase");

const PAYMENTS_TABLE = "Payments";
const FIELDS = ['payment_id', 'title', 'created_at', 'due_date', 'payment_value', 'overdue_penalty'];

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const REGION = process.env.AWS_REGION;

exports.handler = async (event) => {

    try {
        const parameters = event.headers;
        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        const response = getFromTable(PAYMENTS_TABLE, FIELDS, parameters, supabase);

        return response;

    } catch (err) {
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};