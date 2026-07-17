const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { query } = require("../../shared_utils/db");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");

const REGION = process.env.AWS_REGION;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};
    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const { family_name, members = [] } = JSON.parse(event.body || "{}");

        if (!family_name?.trim()) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: "family_name is required" }),
            };
        }

        const updateResult = await ddb.send(new UpdateCommand({
            TableName: "appConfigs",
            Key: { type: "familyIdCounter" },
            UpdateExpression: "ADD #counter :val",
            ExpressionAttributeNames: { "#counter": "idCounter" },
            ExpressionAttributeValues: { ":val": 1 },
            ReturnValues: "ALL_NEW",
        }));
        const familyId = updateResult.Attributes.idCounter;

        await query(
            `INSERT INTO families (family_id, family_name) VALUES ($1, $2)`,
            [familyId, family_name.trim()]
        );

        const seen = new Set();
        for (const m of members) {
            const memberId = Number(m.member_id);
            if (!memberId || seen.has(memberId)) continue;
            seen.add(memberId);
            await query(
                `INSERT INTO family_members (family_id, member_id, is_parent) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                [familyId, memberId, !!m.is_parent]
            );
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Family created", family_id: familyId }),
        };
    } catch (err) {
        console.error("createFamily error:", err);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: err.message }),
        };
    }
};
