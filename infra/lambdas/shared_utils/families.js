const { query } = require("./db");
const { getMemberIdByToken } = require("./members");

async function resolveActingMemberId(claims) {
  return getMemberIdByToken(claims);
}

async function canActFor(actingMemberId, targetMemberId) {
  if (actingMemberId == null || targetMemberId == null) return false;
  if (Number(actingMemberId) === Number(targetMemberId)) return true;

  const res = await query(
    `SELECT 1 FROM family_members actor
     JOIN family_members target ON target.family_id = actor.family_id
     WHERE actor.member_id = $1 AND actor.is_parent = TRUE AND target.member_id = $2
     LIMIT 1`,
    [actingMemberId, targetMemberId]
  );
  return res.rowCount > 0;
}

module.exports = { resolveActingMemberId, canActFor };
