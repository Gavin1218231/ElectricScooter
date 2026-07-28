/**
 * JWT authentication middleware for the Vim scooter app.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database');

// Never ship a hardcoded fallback secret: a committed default lets anyone forge
// tokens for any account. Use JWT_SECRET from the environment; if it is absent
// (e.g. local dev with no .env), generate a random per-process secret so tokens
// are still unforgeable — they simply don't survive a server restart.
// A random per-process secret is cryptographically fine but operationally bad:
// under a cluster or multiple replicas each worker signs with a different key,
// so users are logged out at random depending on which worker serves them — an
// intermittent, hard-to-diagnose outage that never appears in single-process dev.
// Fail fast instead, except in tests where an ephemeral secret is what we want.
// Note the allowlist is explicit ('test'/'development'), not `!== 'production'`:
// NODE_ENV is unset in a plain `node src/index.js` deploy, so a negative check
// would quietly hand a real deployment the unstable per-process key.
const EPHEMERAL_SECRET_OK = ['test', 'development'].includes(process.env.NODE_ENV);
const JWT_SECRET = process.env.JWT_SECRET || (
  EPHEMERAL_SECRET_OK
    ? crypto.randomBytes(32).toString('hex')
    : null
);
if (JWT_SECRET && !process.env.JWT_SECRET) {
  console.warn(
    '[auth] JWT_SECRET is not set — using a random per-process secret because ' +
    `NODE_ENV=${process.env.NODE_ENV}. Sessions reset on restart. Do not use this in production.`
  );
}
if (!JWT_SECRET) {
  console.error(
    '[auth] FATAL: JWT_SECRET is not set. Generate one with:\n' +
    '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
    'Refusing to start rather than sign tokens with an unstable per-process key.'
  );
  process.exit(1);
}

/**
 * Generate a JWT token for a user.
 * @param {object} user - The user object (must have id and email)
 * @returns {string} JWT token
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d', algorithm: 'HS256' }
  );
}

/**
 * Required authentication middleware.
 * Extracts and verifies the JWT from the Authorization header.
 * Sets req.user with the full user record (excluding password_hash).
 * Returns 401 if no token or invalid token.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please provide a valid Bearer token.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const db = getDb();
    const user = db.prepare('SELECT id, email, name, phone, balance, created_at, updated_at FROM users WHERE id = ?').get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User not found. Token may be invalid.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

/**
 * Optional authentication middleware.
 * If a valid token is present, sets req.user. Otherwise, continues without error.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const db = getDb();
    const user = db.prepare('SELECT id, email, name, phone, balance, created_at, updated_at FROM users WHERE id = ?').get(decoded.id);
    req.user = user || null;
  } catch (err) {
    req.user = null;
  }

  next();
}

module.exports = {
  generateToken,
  authenticate,
  optionalAuth,
  JWT_SECRET,
};
