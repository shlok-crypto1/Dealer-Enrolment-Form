const msg91 = require('./_lib/msg91');
const token = require('./_lib/token');

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ verified: false, message: 'Method not allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const mobile = digitsOnly(body && body.mobile);
  const otp = digitsOnly(body && body.otp);

  if (mobile.length !== 10 || otp.length !== 6) {
    res.status(400).json({ verified: false, message: 'Enter the 6-digit code sent to your number.' });
    return;
  }

  try {
    const result = await msg91.verifyOtp(mobile, otp);
    if (!result.ok) {
      res.status(400).json({
        verified: false,
        message: (result.data && result.data.message) || 'Incorrect code. Please try again.'
      });
      return;
    }

    const signed = token.sign({ mobile: mobile, verified: true }, TOKEN_TTL_MS);
    res.status(200).json({
      verified: true,
      mobile: mobile,
      token: signed.token,
      expiresAt: signed.payload.exp
    });
  } catch (err) {
    res.status(500).json({ verified: false, message: 'Server is not configured to verify OTPs right now.' });
  }
};
