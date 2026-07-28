const gstinApi = require('./_lib/gstin');
const rateLimit = require('./_lib/rateLimit');

// Standard 15-character GSTIN format: 2-digit state code, 10-char PAN,
// 1-digit entity code, 'Z' by default, 1 checksum char.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_KEY = 5;
const ipLimiter = rateLimit.createLimiter(WINDOW_MS, MAX_PER_KEY);
const gstinLimiter = rateLimit.createLimiter(WINDOW_MS, MAX_PER_KEY);

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ verified: false, message: 'Method not allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const gstin = String((body && body.gstin) || '').trim().toUpperCase();

  if (!GSTIN_RE.test(gstin)) {
    res.status(400).json({ verified: false, message: 'Enter a valid 15-character GSTIN.' });
    return;
  }

  const ipCheck = ipLimiter(clientIp(req));
  const gstinCheck = gstinLimiter(gstin);
  if (!ipCheck.allowed || !gstinCheck.allowed) {
    res.status(429).json({ verified: false, message: 'Too many attempts. Please try again later.' });
    return;
  }

  try {
    const result = await gstinApi.verifyGstin(gstin);
    if (!result.ok) {
      res.status(400).json({
        verified: false,
        message: (result.data && result.data.message) || 'GSTIN could not be verified.'
      });
      return;
    }
    const data = result.data;
    res.status(200).json({
      verified: true,
      gstin: data.GSTIN || gstin,
      legalName: data.legal_name_of_business || '',
      tradeName: data.trade_name_of_business || '',
      status: data.gst_in_status || ''
    });
  } catch (err) {
    res.status(500).json({ verified: false, message: 'Server is not configured to verify GSTIN right now.' });
  }
};
