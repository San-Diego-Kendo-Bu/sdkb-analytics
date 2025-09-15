import { createClient } from "https://esm.sh/@supabase/supabase-js";
const endpoint = 'https://gsriiicvvxzvidaakctw.supabase.co';
const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcmlpaWN2dnh6dmlkYWFrY3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDg0MjUsImV4cCI6MjA3MDcyNDQyNX0.GtHJ405NZAA8V2RQy1h6kz3wIrdraaOEXTKTentoePE';

exports.handler = async (event) => {
    try {

        return{
            statusCode : 200,
            headers : {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body : JSON.stringify({
                message: "Created Payment Successfully",
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};