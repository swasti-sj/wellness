const jwt = require('jsonwebtoken');

// Uploaded medical documents are loaded by plain <img>/<iframe>/<a> tags,
// which can't send an Authorization header. So at login we also set an
// HttpOnly cookie that the browser attaches to those requests automatically.
//
// It is signed with a *derived* secret so the cookie can only open files —
// it is rejected if someone tries to use it as a normal API Bearer token.
const COOKIE_NAME = 'wellness_files';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const fileSecret = () => `${process.env.JWT_SECRET}:uploads`;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: (process.env.FRONTEND_URL || '').startsWith('https://'),
    path: '/',
  };
}

// Call right before redirecting back to the frontend after login, passing
// the API token that was just issued
function setFileCookie(res, apiToken) {
  const { id, role } = jwt.decode(apiToken) || {};
  const fileToken = jwt.sign({ id, role, purpose: 'files' }, fileSecret(), { expiresIn: '1d' });
  res.cookie(COOKIE_NAME, fileToken, { ...cookieOptions(), maxAge: ONE_DAY_MS });
}

function clearFileCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1 && part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

// Express middleware guarding the uploads static folder
function requireFileAccess(req, res, next) {
  const token = readCookie(req, COOKIE_NAME);
  if (!token) return res.status(401).send('Please log in to view this file.');
  try {
    const decoded = jwt.verify(token, fileSecret());
    if (decoded.purpose !== 'files') throw new Error('wrong token type');
    next();
  } catch (err) {
    return res.status(401).send('Your session has expired. Please log in again to view this file.');
  }
}

module.exports = { setFileCookie, clearFileCookie, requireFileAccess };
