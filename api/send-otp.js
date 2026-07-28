const msg91 = require('./_lib/msg91');
const rateLimit = require('./_lib/rateLimit');

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

const otpLimiter = rateLimit.createLimiter(10 * 60 * 1000, 3);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ sent: false, message: 'Method not allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const mobile = digitsOnly(body && body.mobile);

  if (mobile.length !== 10) {
    res.status(400).json({ sent: false, message: 'Enter a valid 10-digit mobile number.' });
    return;
  }

  const rl = otpLimiter(mobile);
  if (!rl.allowed) {
    res.status(429).json({
      sent: false,
      message: 'Too many attempts for this number. Please try again later.',
      retryAfterMs: rl.retryAfterMs
    });
    return;
  }

  try {
    const result = await msg91.sendOtp(mobile);
    if (!result.ok) {
      res.status(502).json({
        sent: false,
        message: (result.data && result.data.message) || 'Could not send the code. Please try again.'
      });
      return;
    }
    res.status(200).json({ sent: true });
  } catch (err) {
    res.status(500).json({ sent: false, message: 'Server is not configured to send OTPs right now.' });
  }
};
