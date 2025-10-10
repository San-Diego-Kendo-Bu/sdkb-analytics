const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
    QueryCommand,
    DynamoDBDocumentClient
} = require("@aws-sdk/lib-dynamodb");

const { getSupabase } = require("../../shared_utils/supabase");

const PAYMENTS_TABLE = "Payments";
const PAYMENT_ID_ATTR = "payment_id";
const ASSIGNED_PAYMENTS_TABLE = "AssignedPayments";

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const REGION = process.env.AWS_REGION;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region : REGION }));

const MEMBER_ID_ATTR = "member_id";
const MEMBERS_TABLE  = "members";

const REQUIRED_FIELDS = ["member_id", "payment_id", "assigned_on", "status"];

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
        
        const memberId = parseInt(payload[MEMBER_ID_ATTR]);
        const paymentId = parseInt(payload[PAYMENT_ID_ATTR]);

        const member = await getMemberByMemberId(memberId);
        if(member.length == 0){
            return { statusCode: 400, body: "Invalid member ID." };
        }

        // Get Payment Id from Supabase
        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        const payment = await supabase.from(PAYMENTS_TABLE).select('*').eq(PAYMENT_ID_ATTR, paymentId);
        if(Object.keys(payment.data).length == 0){
            return { statusCode: 400, body: "Invalid payment ID." };
        }

        // Create new AssignedPayment with member_id, payment_id, assigned_on, status
        const response = await supabase.from(ASSIGNED_PAYMENTS_TABLE).insert(payload);
        
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
                response : response.data
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

/**
 * TODO: this is copy pasted from getMembers. We should probably create a shared library for this.
 * @param {*} memberId 
 * @returns 
 */
async function getMemberByMemberId(memberId) {
  const responseItems = [];
  let lastKey;
  do {
    const response = await ddb.send(new QueryCommand({
      TableName: MEMBERS_TABLE,
      KeyConditionExpression: "#e = :e",
      ExpressionAttributeNames:  { "#e": MEMBER_ID_ATTR },
      ExpressionAttributeValues: { ":e": memberId },
      ExclusiveStartKey: lastKey,
    }));
    responseItems.push(...(response.Items || []));
    lastKey = response.LastEvaluatedKey;
  } while (lastKey);

  return responseItems;
}