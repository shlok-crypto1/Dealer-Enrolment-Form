const rateLimit = require('./_lib/rateLimit');

// India Post's public pincode API (https://api.postalpincode.in) needs no
// key, but it sends no CORS headers, so the browser can't call it directly —
// this just proxies the lookup and normalizes the response.
const PINCODE_RE = /^[1-9][0-9]{5}$/;

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 20;
const ipLimiter = rateLimit.createLimiter(WINDOW_MS, MAX_PER_IP);

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ found: false, message: 'Method not allowed' });
    return;
  }

  const pincode = String((req.query && req.query.pincode) || '').trim();
  if (!PINCODE_RE.test(pincode)) {
    res.status(400).json({ found: false, message: 'Enter a valid 6-digit pincode.' });
    return;
  }

  const rl = ipLimiter(clientIp(req));
  if (!rl.allowed) {
    res.status(429).json({ found: false, message: 'Too many attempts. Please try again later.' });
    return;
  }

  try {
    const apiRes = await fetch('https://api.postalpincode.in/pincode/' + encodeURIComponent(pincode));
    const data = await apiRes.json().catch(function () { return null; });
    const entry = Array.isArray(data) ? data[0] : null;

    if (!entry || entry.Status !== 'Success' || !entry.PostOffice || !entry.PostOffice.length) {
      res.status(404).json({ found: false, message: 'Pincode not found.' });
      return;
    }

    const office = entry.PostOffice[0];
    res.status(200).json({
      found: true,
      pincode: pincode,
      district: office.District || '',
      state: office.State || '',
      country: office.Country || 'India'
    });
  } catch (err) {
    res.status(502).json({ found: false, message: 'Could not look up this pincode right now.' });
  }
};
