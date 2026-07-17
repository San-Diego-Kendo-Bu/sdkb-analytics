const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { query } = require("../../shared_utils/db");
const { getAllMembers } = require("../../shared_utils/members");
const { sendEmails } = require("../../shared_utils/mailer");

const REGION = process.env.AWS_REGION;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

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
    const active = (m) => m.status !== "guest" && m.status !== "inactive";
    const notSensei = (m) =>
        m.rank_type !== "shihan" &&
        !(m.rank_type === "dan" && Number(m.rank_number) >= 4);

    switch (target) {
        case "all":           return allMembers.filter(active);
        case "dojo_due":      return allMembers.filter((m) => m.status === "active");
        case "adults":        return allMembers.filter((m) => active(m) && notSensei(m) && !m.is_student && (calcAge(m.birthday) ?? Infinity) > 18);
        case "students":      return allMembers.filter((m) => active(m) && m.is_student === true);
        case "kids":          return allMembers.filter((m) => active(m) && !m.is_student && (calcAge(m.birthday) ?? Infinity) <= 18);
        default:              return [];
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

async function createPaymentAndAssign(paymentId, now, rec, paymentValue, title, memberIds) {
    await query(
        `INSERT INTO payments (payment_id, created_at, payment_value, overdue_penalty, due_date, title, has_submission, is_dojo_due)
         VALUES ($1, $2, $3, $4, $5, $6, false, false)`,
        [paymentId, now, paymentValue, rec.overdue_penalty, rec.next_due_date, title]
    );
    for (const memberId of memberIds) {
        await query(
            `INSERT INTO assigned_payments (member_id, payment_id, assigned_on, due_status)
             VALUES ($1, $2, $3, 'due') ON CONFLICT DO NOTHING`,
            [memberId, paymentId, now]
        );
    }
}

async function sendPaymentEmail(emails, title, paymentValue, nextDueDate, templateId) {
    if (!emails.length) return;
    try {
        const dueDateStr = new Date(nextDueDate).toLocaleDateString("en-US", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
        });
        const amount = `$${parseFloat(paymentValue).toFixed(2)}`;
        const subject = `Payment Due: ${title}`;
        const html = `<p>A payment has been assigned to your account.</p><p><strong>Title:</strong> ${title}</p><p><strong>Amount:</strong> ${amount}</p><p><strong>Due Date:</strong> ${dueDateStr}</p><p>Log in to the SDKB portal to submit your payment: <a href="https://sdkbportal.org">sdkbportal.org</a></p>`;
        const text = `Payment Due: ${title}\n\nAmount: ${amount}\nDue Date: ${dueDateStr}\n\nLog in at https://sdkbportal.org`;
        await sendEmails(emails, subject, html, text);
    } catch (emailErr) {
        console.error(`processRecurrings: email error for template ${templateId}:`, emailErr);
    }
}

exports.handler = async () => {
    try {
        const due = await query(`
            SELECT rp.payment_id AS template_id, rp.interval_months, rp.broadcast_target, rp.next_due_date,
                   rp.designated_parents,
                   p.title, p.payment_value, p.overdue_penalty
            FROM recurring_payments rp
            JOIN payments p ON rp.payment_id = p.payment_id
            WHERE rp.is_active = true AND rp.next_due_date <= NOW() + INTERVAL '14 days'
        `);

        if (due.rowCount === 0) {
            console.log("processRecurrings: nothing due");
            return { statusCode: 200, body: "nothing due" };
        }

        const allMembers = await getAllMembers();
        const allMemberMap = new Map(allMembers.map((m) => [m.member_id, m]));

        const familyMemberRows = await query(`SELECT DISTINCT member_id FROM family_members`);
        const familyMemberIdSet = new Set(familyMemberRows.rows.map((r) => Number(r.member_id)));

        for (const rec of due.rows) {
            try {
                const now = new Date().toISOString();

                if (rec.broadcast_target === "families") {
                    // Per family: the first active parent (by member_id ASC) pays full price.
                    // All other members — including additional parents — pay 50%.
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

                    const isActive = (id) => {
                        const m = allMemberMap.get(id);
                        return m && m.status !== "guest" && m.status !== "inactive";
                    };
                    const getEmails = (ids) =>
                        [...new Set(ids.map((id) => allMemberMap.get(id)?.email).filter(Boolean))];

                    const dpConfig = rec.designated_parents || {};
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

                    const getMemberCategory = (id) => {
                        const m = allMemberMap.get(id);
                        if (!m) return "adult";
                        const age = calcAge(m.birthday);
                        if (age !== null && age <= 18) return "youth";
                        if (m.is_student === true) return "student";
                        return "adult";
                    };

                    const parentIds = [...designatedParents];
                    const nonParentIds = [...allFamilyMemberIds].filter((id) => !designatedParents.has(id));
                    const youthIds      = nonParentIds.filter((id) => getMemberCategory(id) === "youth");
                    const studentIds    = nonParentIds.filter((id) => getMemberCategory(id) === "student");
                    const otherAdultIds = nonParentIds.filter((id) => getMemberCategory(id) === "adult");

                    const fullPrice    = parseFloat(rec.payment_value);
                    const halfPrice    = parseFloat((fullPrice * 0.5).toFixed(2));
                    const youthPrice   = rec.youth_payment_value   != null ? parseFloat(rec.youth_payment_value)   : halfPrice;
                    const studentPrice = rec.student_payment_value != null ? parseFloat(rec.student_payment_value) : halfPrice;

                    const batches = [
                        { ids: parentIds,     price: fullPrice,    title: rec.title },
                        { ids: youthIds,      price: youthPrice,   title: `${rec.title} (Youth)` },
                        { ids: studentIds,    price: studentPrice, title: `${rec.title} (Student)` },
                        { ids: otherAdultIds, price: halfPrice,    title: `${rec.title} (50% off)` },
                    ].filter((b) => b.ids.length > 0);

                    for (const batch of batches) {
                        const pid = await allocatePaymentId();
                        await createPaymentAndAssign(pid, now, rec, batch.price, batch.title, batch.ids);
                        await sendPaymentEmail(getEmails(batch.ids), batch.title, batch.price, rec.next_due_date, rec.template_id);
                        console.log(`processRecurrings: families "${batch.title}" payment ${pid} from template ${rec.template_id} → ${batch.ids.length} members at $${batch.price}`);
                    }

                    if (guestFamilyEmails.size > 0) {
                        try {
                            const dueDateStr = new Date(rec.next_due_date).toLocaleDateString("en-US", {
                                weekday: "long", year: "numeric", month: "long", day: "numeric",
                            });
                            const subject = `Family Payment Notice: ${rec.title}`;
                            const html = `<p>A payment has been issued for your family.</p><p><strong>Title:</strong> ${rec.title}</p><p><strong>Due Date:</strong> ${dueDateStr}</p><p>Log in to the SDKB portal for details: <a href="https://sdkbportal.org">sdkbportal.org</a></p>`;
                            const text = `Family Payment Notice: ${rec.title}\n\nDue Date: ${dueDateStr}\n\nLog in at https://sdkbportal.org`;
                            await sendEmails([...guestFamilyEmails], subject, html, text);
                        } catch (emailErr) {
                            console.error(`processRecurrings: guest email error for template ${rec.template_id}:`, emailErr);
                        }
                    }

                } else {
                    const paymentId = await allocatePaymentId();
                    const targets = filterMembers(allMembers, rec.broadcast_target)
                        .filter((m) => !familyMemberIdSet.has(m.member_id));
                    const memberIds = targets.map((m) => m.member_id);
                    const memberEmails = [...new Set(targets.map((m) => m.email).filter(Boolean))];

                    await createPaymentAndAssign(paymentId, now, rec, rec.payment_value, rec.title, memberIds);
                    await sendPaymentEmail(memberEmails, rec.title, rec.payment_value, rec.next_due_date, rec.template_id);
                    console.log(`processRecurrings: cycle payment ${paymentId} from template ${rec.template_id} (${rec.title}) → ${memberIds.length} members`);
                }

                // Advance next_due_date by the interval regardless of target type
                await query(
                    `UPDATE recurring_payments
                     SET next_due_date = next_due_date + ($1 || ' months')::interval
                     WHERE payment_id = $2`,
                    [rec.interval_months, rec.template_id]
                );

            } catch (innerErr) {
                console.error(`processRecurrings: failed for template ${rec.template_id}:`, innerErr);
            }
        }

        return { statusCode: 200, body: `Processed ${due.rowCount} recurring payment(s)` };
    } catch (err) {
        console.error("processRecurrings error:", err);
        return { statusCode: 500, body: err.message };
    }
};
