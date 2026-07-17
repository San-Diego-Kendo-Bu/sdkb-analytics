const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { query } = require("../../shared_utils/db");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");
const { getAllMembers } = require("../../shared_utils/members");
const { sendEmails } = require("../../shared_utils/mailer");

const REGION = process.env.AWS_REGION;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const H = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
const VALID_TARGETS = ["all", "dojo_due", "adults", "students", "kids", "families"];
const VALID_INTERVALS = [3, 6, 9, 12];

function calcAge(birthday) {
    if (!birthday) return null;
    const today = new Date();
    const dob = new Date(birthday);
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
}

function filterMembers(allMembers, target) {
    const active = (m) => m.status === "active";
    const notSensei = (m) =>
        m.rank_type !== "shihan" &&
        !(m.rank_type === "dan" && Number(m.rank_number) >= 4);
    switch (target) {
        case "all":      return allMembers.filter((m) => m.status !== "guest" && m.status !== "inactive");
        case "dojo_due": return allMembers.filter(active);
        case "adults":   return allMembers.filter((m) => active(m) && notSensei(m) && !m.is_student && (calcAge(m.birthday) ?? Infinity) > 18);
        case "students": return allMembers.filter((m) => active(m) && m.is_student === true);
        case "kids":     return allMembers.filter((m) => active(m) && !m.is_student && (calcAge(m.birthday) ?? Infinity) <= 18);
        default:         return [];
    }
}

async function allocatePaymentId() {
    const result = await ddb.send(new UpdateCommand({
        TableName: "appConfigs",
        Key: { type: "paymentIdCounter" },
        UpdateExpression: "ADD #counter :val",
        ExpressionAttributeNames: { "#counter": "idCounter" },
        ExpressionAttributeValues: { ":val": 1 },
        ReturnValues: "ALL_NEW",
    }));
    return result.Attributes.idCounter;
}

async function sendPaymentEmail(emails, title, paymentValue, dueDate) {
    if (!emails.length) return;
    try {
        const dueDateStr = new Date(dueDate).toLocaleDateString("en-US", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
        });
        const amount = `$${parseFloat(paymentValue).toFixed(2)}`;
        const subject = `Payment Due: ${title}`;
        const html = `<p>A payment has been assigned to your account.</p><p><strong>Title:</strong> ${title}</p><p><strong>Amount:</strong> ${amount}</p><p><strong>Due Date:</strong> ${dueDateStr}</p><p>Log in to the SDKB portal to submit your payment: <a href="https://sdkbportal.org">sdkbportal.org</a></p>`;
        const text = `Payment Due: ${title}\n\nAmount: ${amount}\nDue Date: ${dueDateStr}\n\nLog in at https://sdkbportal.org`;
        await sendEmails(emails, subject, html, text);
    } catch (err) {
        console.error("createRecurring: email error:", err);
    }
}

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};
    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const { title, payment_value, next_due_date, overdue_penalty, interval_months, broadcast_target, designated_parents } =
            JSON.parse(event.body || "{}");

        if (!title?.trim())
            return { statusCode: 400, headers: H, body: JSON.stringify({ error: "title is required" }) };
        if (!payment_value || parseFloat(payment_value) < 0.01)
            return { statusCode: 400, headers: H, body: JSON.stringify({ error: "payment_value is required" }) };
        if (!next_due_date)
            return { statusCode: 400, headers: H, body: JSON.stringify({ error: "next_due_date is required" }) };
        if (!VALID_INTERVALS.includes(Number(interval_months)))
            return { statusCode: 400, headers: H, body: JSON.stringify({ error: "interval_months must be 3, 6, 9, or 12" }) };
        if (!VALID_TARGETS.includes(broadcast_target))
            return { statusCode: 400, headers: H, body: JSON.stringify({ error: `broadcast_target must be one of: ${VALID_TARGETS.join(", ")}` }) };

        const templateId = await allocatePaymentId();
        const now = new Date().toISOString();
        const value = parseFloat(payment_value);
        const penalty = overdue_penalty ? parseFloat(overdue_penalty) : 0;
        const isFamilies = broadcast_target === "families";
        const dpConfig = (isFamilies && designated_parents && Object.keys(designated_parents).length > 0)
            ? designated_parents : {};
        const dpJson = Object.keys(dpConfig).length > 0 ? JSON.stringify(dpConfig) : null;

        // Create the template payment row (used as first-cycle payment for non-family,
        // or as the full-price parent payment for families)
        await query(
            `INSERT INTO payments (payment_id, created_at, payment_value, overdue_penalty, due_date, title, has_submission, is_dojo_due)
             VALUES ($1, $2, $3, $4, $5, $6, false, false)`,
            [templateId, now, value, penalty, next_due_date, title.trim()]
        );

        await query(
            `INSERT INTO recurring_payments (payment_id, interval_months, broadcast_target, next_due_date, designated_parents)
             VALUES ($1, $2, $3, $4, $5)`,
            [templateId, Number(interval_months), broadcast_target, next_due_date, dpJson]
        );

        // --- Immediate first-cycle assignment ---
        const allMembers = await getAllMembers();
        const allMemberMap = new Map(allMembers.map((m) => [m.member_id, m]));

        if (isFamilies) {
            const familyRows = await query(`
                SELECT family_id, member_id, is_parent
                FROM family_members
                ORDER BY family_id, member_id
            `);
            const familiesByGroup = new Map();
            for (const row of familyRows.rows) {
                const fid = row.family_id;
                if (!familiesByGroup.has(fid)) familiesByGroup.set(fid, []);
                familiesByGroup.get(fid).push({ member_id: Number(row.member_id), is_parent: Boolean(row.is_parent) });
            }

            const isActive = (id) => { const m = allMemberMap.get(id); return m && m.status === "active"; };
            const getEmails = (ids) => [...new Set(ids.map((id) => allMemberMap.get(id)?.email).filter(Boolean))];

            const designatedParents = new Set();
            const allFamilyMemberIds = new Set();
            const guestFamilyEmails = new Set();

            for (const [fid, members] of familiesByGroup.entries()) {
                const configuredId = dpConfig[String(fid)] ? Number(dpConfig[String(fid)]) : null;
                const isMemberOfFamily = (id) => members.some((m) => m.member_id === id);
                let chosenParent = null;
                if (configuredId && isActive(configuredId) && isMemberOfFamily(configuredId)) {
                    chosenParent = configuredId;
                } else {
                    const firstParent = members.find((m) => m.is_parent && isActive(m.member_id));
                    if (firstParent) chosenParent = firstParent.member_id;
                }
                if (chosenParent) designatedParents.add(chosenParent);
                for (const m of members) {
                    if (isActive(m.member_id)) {
                        allFamilyMemberIds.add(m.member_id);
                    } else {
                        const member = allMemberMap.get(m.member_id);
                        if (member?.status === "guest" && member.email) guestFamilyEmails.add(member.email);
                    }
                }
            }

            const parentIds    = [...designatedParents];
            const nonParentIds = [...allFamilyMemberIds].filter((id) => !designatedParents.has(id));
            const halfPrice    = parseFloat((value * 0.5).toFixed(2));

            // Assign template payment (full price) to parents
            if (parentIds.length > 0) {
                for (const memberId of parentIds) {
                    await query(
                        `INSERT INTO assigned_payments (member_id, payment_id, assigned_on, due_status)
                         VALUES ($1, $2, $3, 'due') ON CONFLICT DO NOTHING`,
                        [memberId, templateId, now]
                    );
                }
                await sendPaymentEmail(getEmails(parentIds), title.trim(), value, next_due_date);
            }

            // Create a separate 50%-off payment for non-parents
            if (nonParentIds.length > 0) {
                const halfId = await allocatePaymentId();
                const halfTitle = `${title.trim()} (50% off)`;
                await query(
                    `INSERT INTO payments (payment_id, created_at, payment_value, overdue_penalty, due_date, title, has_submission, is_dojo_due)
                     VALUES ($1, $2, $3, $4, $5, $6, false, false)`,
                    [halfId, now, halfPrice, penalty, next_due_date, halfTitle]
                );
                for (const memberId of nonParentIds) {
                    await query(
                        `INSERT INTO assigned_payments (member_id, payment_id, assigned_on, due_status)
                         VALUES ($1, $2, $3, 'due') ON CONFLICT DO NOTHING`,
                        [memberId, halfId, now]
                    );
                }
                await sendPaymentEmail(getEmails(nonParentIds), halfTitle, halfPrice, next_due_date);
            }

            if (guestFamilyEmails.size > 0) {
                try {
                    const dueDateStr = new Date(next_due_date).toLocaleDateString("en-US", {
                        weekday: "long", year: "numeric", month: "long", day: "numeric",
                    });
                    const subject = `Family Payment Notice: ${title.trim()}`;
                    const html = `<p>A payment has been issued for your family.</p><p><strong>Title:</strong> ${title.trim()}</p><p><strong>Due Date:</strong> ${dueDateStr}</p><p>Log in to the SDKB portal for details: <a href="https://sdkbportal.org">sdkbportal.org</a></p>`;
                    const text = `Family Payment Notice: ${title.trim()}\n\nDue Date: ${dueDateStr}\n\nLog in at https://sdkbportal.org`;
                    await sendEmails([...guestFamilyEmails], subject, html, text);
                } catch (emailErr) {
                    console.error("createRecurring: guest email error:", emailErr);
                }
            }
        } else {
            const familyMemberRows = await query(`SELECT DISTINCT member_id FROM family_members`);
            const familyMemberIdSet = new Set(familyMemberRows.rows.map((r) => Number(r.member_id)));
            const targets = filterMembers(allMembers, broadcast_target).filter((m) => !familyMemberIdSet.has(m.member_id));
            const memberIds = targets.map((m) => m.member_id);
            const memberEmails = [...new Set(targets.map((m) => m.email).filter(Boolean))];

            for (const memberId of memberIds) {
                await query(
                    `INSERT INTO assigned_payments (member_id, payment_id, assigned_on, due_status)
                     VALUES ($1, $2, $3, 'due') ON CONFLICT DO NOTHING`,
                    [memberId, templateId, now]
                );
            }
            await sendPaymentEmail(memberEmails, title.trim(), value, next_due_date);
        }

        // Advance next_due_date so processRecurrings picks up the next cycle 2 weeks before that date
        await query(
            `UPDATE recurring_payments
             SET next_due_date = next_due_date + ($1 || ' months')::interval
             WHERE payment_id = $2`,
            [Number(interval_months), templateId]
        );

        return {
            statusCode: 200,
            headers: H,
            body: JSON.stringify({ message: "Recurring payment created", payment_id: templateId }),
        };
    } catch (err) {
        console.error("createRecurring error:", err);
        return { statusCode: 500, headers: H, body: JSON.stringify({ error: err.message }) };
    }
};
