const { getSupabase, callPostgresFunction } = require("../../shared_utils/supabase");
const { getAllMemberIds } = require("../../shared_utils/members");
const { getCurrentTimeUTC } = require("../../shared_utils/dates");

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient, UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const PAYMENTS_TABLE = "Payments";
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
            const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
    
            const updateParams = {
                TableName: "appConfigs",
                Key: { type: "paymentIdCounter" },
                UpdateExpression: "ADD #counter :val",
                ExpressionAttributeNames: { "#counter": "idCounter" },
                ExpressionAttributeValues: { ":val": 1 },
                ReturnValues: "ALL_NEW",
            };
            const updateResult = await ddb.send(new UpdateCommand(updateParams));
            const newPaymentId = updateResult.Attributes.idCounter;

            // Create the payment 
            const title = parameters.title;
            const createdAt = parameters.created_at ? parameters.created_at : getCurrentTimeUTC();
            const dueDate = parameters.due_date;
            const paymentValue = parameters.payment_value ? parseFloat(parameters.payment_value) : null;
            const overduePenalty = parameters.overdue_penalty ? parseFloat(parameters.overdue_penalty) : 0.0;
            const federationDue = parameters.federation_due ? parameters.federation_due : false;
            const dojoDue = parameters.dojo_due ? parameters.dojo_due : false;

            if (federationDue === true && dojoDue === true) {
                return {
                    statusCode: 400,
                    message: "Payment cannot be both federation due and dojo due."
                }
            } else if (federationDue === false && dojoDue === false) {
                return {
                    statusCode: 400,
                    message: "Payment must be either federation due or dojo due."
                }
            }
    
            if(!paymentValue || paymentValue < 1.0){
                return{
                    statusCode: 400,
                    message: "Invalid payment value. Please create a payment of at least $1.00.",
                    body: JSON.stringify({
                        message: "Please create a payment of at least $1.00.",
                        payment_value : paymentValue
                    })
                };
            }

            if(overduePenalty < 0.0){
                return{
                    statusCode: 400,
                    message: "Invalid overdue penalty value. Please create a penalty of at least $0.00.",
                    body: JSON.stringify({
                        message: "Please create a penalty of at least $0.00.",
                        payment_value : overduePenalty
                    })
                };
            }
            
            const response = await supabase.from(PAYMENTS_TABLE).insert({
                payment_id: newPaymentId,
                title: title,
                created_at: createdAt,
                due_date: dueDate,
                payment_value: paymentValue,
                overdue_penalty: overduePenalty,
            }).select();
            
            if(response.error){
                return {
                    statusCode: 500,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ error: response.error })
                };
            }

            // Get member_ids to assign payment to
            let memberIds = [];

            if(dojoDue){
                memberIds = await getAllMemberIds(true, true, false);
            } else if(federationDue){
                memberIds = await getAllMemberIds(false, true, false);
            } 

            // Assign payment to every member applicable
            for (const memberId of memberIds){
                const args = {
                    p_member_id: memberId,
                    p_payment_id: newPaymentId,
                    p_assigned_on: getCurrentTimeUTC(),
                    p_status: "due"
                };
                console.log(`Assigning payment ${newPaymentId} to member ${memberId}`);
                
                const resp = await callPostgresFunction('assign_payment', args, supabase);
                console.log(`Response for member ${memberId}:`, resp);
                if (resp.error) {   
                    return {
                        statusCode: 500,
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ error: resp.error })
                    };
                }
            }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Payment created and assigned successfully.",
                payment_id: newPaymentId,
                assigned_member_count: memberIds.length,
            }),
        };
    
        } catch(err){
            return{
                statusCode : 500,
                headers : {"Content-Type" : "application/json"},
                body : JSON.stringify({ error : err.message })
            };
        }
}