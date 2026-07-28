const supabaseLib = require('./_lib/supabase');
const rateLimit = require('./_lib/rateLimit');

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}
function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}
function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_IP = 10;
const ipLimiter = rateLimit.createLimiter(WINDOW_MS, MAX_PER_IP);

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

// Cosmetic only: makes the dealer code read like "FOA-UP-0148" instead of a
// raw row id. Falls back to the state name's initials if it's not listed.
const STATE_ABBR = {
  'uttar pradesh': 'UP', 'delhi': 'DL', 'maharashtra': 'MH', 'karnataka': 'KA',
  'tamil nadu': 'TN', 'gujarat': 'GJ', 'rajasthan': 'RJ', 'west bengal': 'WB',
  'madhya pradesh': 'MP', 'bihar': 'BR', 'punjab': 'PB', 'haryana': 'HR',
  'telangana': 'TG', 'andhra pradesh': 'AP', 'kerala': 'KL', 'odisha': 'OD',
  'assam': 'AS', 'jharkhand': 'JH', 'chhattisgarh': 'CG', 'uttarakhand': 'UK'
};
function stateAbbr(stateName) {
  const key = str(stateName).toLowerCase();
  if (STATE_ABBR[key]) return STATE_ABBR[key];
  const initials = str(stateName).split(/\s+/).map(function (w) { return w[0] || ''; }).join('').toUpperCase();
  return initials.slice(0, 2) || 'IN';
}

function validate(body) {
  const errs = [];
  if (digitsOnly(body.mobile).length !== 10) errs.push('mobile');
  if (!str(body.ownerName)) errs.push('ownerName');
  if (!str(body.dob)) errs.push('dob');
  if (!body.unmarried && !str(body.anniversary)) errs.push('anniversary');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(body.email))) errs.push('email');
  if (digitsOnly(body.pincode).length !== 6) errs.push('pincode');
  if (!str(body.address)) errs.push('address');
  if (!str(body.landmark)) errs.push('landmark');
  if (!body.galleryAccept) errs.push('galleryAccept');
  if (!body.confirmed) errs.push('confirmed');
  return errs;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const rl = ipLimiter(clientIp(req));
  if (!rl.allowed) {
    res.status(429).json({ success: false, message: 'Too many submissions. Please try again later.' });
    return;
  }

  const errs = validate(body);
  if (errs.length) {
    res.status(400).json({ success: false, message: 'Please check the submitted details.', fields: errs });
    return;
  }

  let supabase;
  try {
    supabase = supabaseLib.getClient();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server is not configured to accept submissions right now.' });
    return;
  }

  const row = {
    mobile: digitsOnly(body.mobile),
    mobile_verified: !!body.mobileVerified,
    verified_mobile: body.verifiedMobile ? digitsOnly(body.verifiedMobile) : null,

    owner_name: str(body.ownerName),
    dob: str(body.dob),
    unmarried: !!body.unmarried,
    anniversary: body.unmarried ? null : str(body.anniversary),
    alt_number: digitsOnly(body.altNumber) || null,
    email: str(body.email),

    pincode: digitsOnly(body.pincode),
    district: str(body.district) || null,
    state: str(body.state) || null,
    address: str(body.address),
    landmark: str(body.landmark),

    shop_size: str(body.shopSize) || null,
    display_count: toInt(body.displayCount),
    staff_count: toInt(body.staffCount),

    years_in_trade: toInt(body.yearsInTrade),
    brands: Array.isArray(body.brands) ? body.brands.map(str).filter(Boolean) : [],
    brands_other: str(body.brandsOther) || null,
    monthly_volume: str(body.monthlyVolume) || null,
    monthly_fv_count: toInt(body.monthlyFoamicoVedasleep),

    gallery_accept: !!body.galleryAccept,
    confirmed: !!body.confirmed,
    lang: str(body.lang) || 'en'
  };

  try {
    const inserted = await supabase.from('foamico_gallery_registrations').insert(row).select('id, state').single();
    if (inserted.error) throw inserted.error;

    const dealerCode = 'FOA-' + stateAbbr(inserted.data.state) + '-' + String(inserted.data.id).padStart(4, '0');

    const updated = await supabase
      .from('foamico_gallery_registrations')
      .update({ dealer_code: dealerCode })
      .eq('id', inserted.data.id);
    if (updated.error) throw updated.error;

    res.status(200).json({ success: true, dealerCode: dealerCode });
  } catch (err) {
    res.status(502).json({ success: false, message: 'Could not save your registration right now. Please try again.' });
  }
};
