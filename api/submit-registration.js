const supabaseLib = require('./_lib/supabase');
const rateLimit = require('./_lib/rateLimit');
const token = require('./_lib/token');

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

  const mobile = digitsOnly(body.mobile);

  // Verify the OTP session token server-side rather than trusting the
  // client's mobileVerified flag outright. Falls back to false when no/an
  // invalid token is supplied — matching the wizard, where OTP is
  // temporarily not required to continue (see index.html step 1 validate()).
  let mobileVerified = false;
  if (body.verifyToken) {
    const payload = token.verify(body.verifyToken);
    if (payload && payload.verified && digitsOnly(payload.mobile) === mobile) {
      mobileVerified = true;
    }
  }

  // Column names here match the actual deployed schema in Supabase
  // (public.foamico_gallery_registrations) — see supabase/schema.sql.
  // dealer_code is intentionally omitted: a BEFORE INSERT trigger
  // (generate_foamico_dealer_code) fills it in atomically per-state, so
  // there's no separate insert-then-update race to worry about.
  const row = {
    language: str(body.lang) === 'hi' ? 'hi' : 'en',
    mobile: mobile,
    mobile_verified: mobileVerified,

    owner_name: str(body.ownerName),
    date_of_birth: str(body.dob),
    is_unmarried: !!body.unmarried,
    anniversary_date: body.unmarried ? null : str(body.anniversary),
    alternate_mobile: digitsOnly(body.altNumber) || null,
    email: str(body.email).toLowerCase(),

    pincode: digitsOnly(body.pincode),
    district: str(body.district) || null,
    state: str(body.state) || null,
    firm_address: str(body.address),
    landmark: str(body.landmark),

    shop_size: str(body.shopSize) || null,
    display_mattress_count: toInt(body.displayCount),
    staff_count: toInt(body.staffCount),

    years_in_trade: toInt(body.yearsInTrade),
    brands_kept: Array.isArray(body.brands) ? body.brands.map(str).filter(Boolean) : [],
    brands_other: str(body.brandsOther) || null,
    monthly_sales_volume: str(body.monthlyVolume) || null,
    fv_monthly_count: toInt(body.monthlyFoamicoVedasleep),

    gallery_commitment_accepted: !!body.galleryAccept,
    final_declaration_confirmed: !!body.confirmed,

    user_agent: req.headers['user-agent'] || null,
    ip_address: clientIp(req),
    raw_payload: body
  };

  try {
    const inserted = await supabase
      .from('foamico_gallery_registrations')
      .insert(row)
      .select('dealer_code')
      .single();

    if (inserted.error) throw inserted.error;

    res.status(200).json({ success: true, dealerCode: inserted.data.dealer_code });
  } catch (err) {
    if (err && err.code === '23505') {
      res.status(409).json({ success: false, message: 'This mobile number is already registered as a Foamico Gallery.' });
      return;
    }
    res.status(502).json({ success: false, message: 'Could not save your registration right now. Please try again.' });
  }
};
