function normalizeGroups(raw) {
  if (Array.isArray(raw)) {
    return raw.flatMap(item => normalizeGroups(item)); // handle nested / mixed shapes
  }
  const s = String(raw || '').trim();

  // If the value is like "[a, b, c]" (stringified array), strip brackets first
  const withoutBrackets = (s.startsWith('[') && s.endsWith(']')) ? s.slice(1, -1) : s;

  // Split by comma, trim entries, drop empties
  return withoutBrackets
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
}

exports.handler = async (event) => {
  const claims =
    event.requestContext?.authorizer?.jwt?.claims ??
    event.requestContext?.authorizer?.claims ??
    {};

  const groups = normalizeGroups(claims['cognito:groups']);
  const isAdmin = groups.some(g => g === 'admins' || g.endsWith(' admins'));

  console.log('Auth debug', {
    email: claims.email,
    groups,
    token_use: claims.token_use,
  });

  if (!isAdmin) {
    return { statusCode: 403, body: 'Forbidden' };
  }
  
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify({
      message: "Retrieved matching admins",
      isAdmin: isAdmin ? true : false
    })
  };
};