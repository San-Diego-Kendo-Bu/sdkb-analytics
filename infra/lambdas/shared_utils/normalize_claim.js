function normalizeGroups(raw) {
    if (Array.isArray(raw)) return raw.flatMap(normalizeGroups);
    const s = String(raw ?? "").trim();
    const withoutBrackets = s.startsWith("[") && s.endsWith("]") ? s.slice(1, -1) : s;
    return withoutBrackets.split(",").map((x) => x.trim()).filter(Boolean);
}

module.exports = { normalizeGroups }