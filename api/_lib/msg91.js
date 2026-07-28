// Thin wrapper around MSG91's v5 OTP API (https://control.msg91.com/api/v5/otp),
// used here with a WhatsApp-channel template so OTPs are delivered over WhatsApp.
// authkey always travels as a header, never in the URL or client-visible response.

const OTP_BASE = 'https://control.msg91.com/api/v5/otp';
const COUNTRY_CODE = '91';

function toMsg91Mobile(mobile) {
  return COUNTRY_CODE + mobile;
}

async function sendOtp(mobile) {
  const authkey = process.env.MSG91_AUTHKEY;
  const templateId = process.env.MSG91_WHATSAPP_TEMPLATE_ID;
  if (!authkey || !templateId) {
    throw new Error('MSG91_AUTHKEY or MSG91_WHATSAPP_TEMPLATE_ID is not configured');
  }

  const url = OTP_BASE
    + '?template_id=' + encodeURIComponent(templateId)
    + '&mobile=' + encodeURIComponent(toMsg91Mobile(mobile));

  const res = await fetch(url, {
    method: 'POST',
    headers: { authkey: authkey, 'Content-Type': 'application/json' }
  });
  const data = await res.json().catch(function () { return {}; });
  return { ok: res.ok && data.type === 'success', data: data };
}

async function verifyOtp(mobile, otp) {
  const authkey = process.env.MSG91_AUTHKEY;
  if (!authkey) {
    throw new Error('MSG91_AUTHKEY is not configured');
  }

  const url = OTP_BASE + '/verify'
    + '?mobile=' + encodeURIComponent(toMsg91Mobile(mobile))
    + '&otp=' + encodeURIComponent(otp);

  const res = await fetch(url, {
    method: 'GET',
    headers: { authkey: authkey }
  });
  const data = await res.json().catch(function () { return {}; });
  return { ok: res.ok && data.type === 'success', data: data };
}

module.exports = { sendOtp: sendOtp, verifyOtp: verifyOtp };
