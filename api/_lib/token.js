// Signs a short-lived, HMAC-authenticated token proving a mobile number was
// verified via /api/verify-otp. The client stores this token (see
// localStorage usage in index.html) purely to survive a page refresh —
// mobileVerified is only ever set to true in wizard state as a direct result
// of a successful /api/verify-otp response, this just lets that fact persist.
const crypto = require('crypto');

function getSecret() {
  return process.env.SESSION_SECRET || process.env.MSG91_AUTHKEY;
}

function sign(payload, ttlMs) {
  const secret = getSecret();
  if (!secret) throw new Error('No secret configured for session tokens');

  const body = Object.assign({}, payload, { iat: Date.now(), exp: Date.now() + ttlMs });
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return { token: encoded + '.' + sig, payload: body };
}

function verify(token) {
  const secret = getSecret();
  if (!secret || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const encoded = parts[0];
  const sig = parts[1];

  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());
  } catch (e) {
    return null;
  }
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
}

module.exports = { sign: sign, verify: verify };
