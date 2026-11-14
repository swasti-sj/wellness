const jwt = require('jsonwebtoken');
const { ipKeyGenerator } = require('express-rate-limit');

function apiRateLimitKey(req) {
  const authorization = req.headers.authorization || '';
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);

  if (tokenMatch) {
    try {
      const decoded = jwt.verify(tokenMatch[1], process.env.JWT_SECRET);
      if (decoded.id && decoded.role) {
        return `user:${decoded.role}:${decoded.id}`;
      }
    } catch (err) {
      if (!(err instanceof jwt.JsonWebTokenError)) throw err;
    }
  }

  return `ip:${ipKeyGenerator(req.ip)}`;
}

module.exports = apiRateLimitKey;
