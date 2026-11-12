// Single place every route reads the login token from.
//
// The token belongs in the Authorization header — query strings end up in
// nginx access logs and browser history. The ?token= / body.token fallback
// is TEMPORARY, so any frontend call we missed keeps working; each use logs
// a warning naming the route. Once the logs show no warnings, delete the
// fallback block below.
function getRequestToken(req) {
  const header = req.headers?.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token) return token;
  }

  // ---- TEMPORARY fallback (remove once no warnings appear) ----
  const legacy = req.query?.token || req.body?.token;
  if (legacy) {
    console.warn(`[auth] Token sent in ${req.query?.token ? 'URL' : 'body'} instead of header: ${req.method} ${req.originalUrl.split('?')[0]}`);
    return legacy;
  }
  // ---- end fallback ----

  return null;
}

module.exports = { getRequestToken };
