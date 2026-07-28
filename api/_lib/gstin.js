// Wrapper around Cashfree's Verification Suite GSTIN API
// (https://www.cashfree.com/docs/api-reference/vrs/v2/gstin/verify-gstin).
// Credentials travel only as server-side headers, never reaching the client.

const BASE_URL = process.env.CASHFREE_ENV === 'sandbox'
  ? 'https://sandbox.cashfree.com/verification/gstin'
  : 'https://api.cashfree.com/verification/gstin';

async function verifyGstin(gstin) {
  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('CASHFREE_CLIENT_ID or CASHFREE_CLIENT_SECRET is not configured');
  }

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'x-client-id': clientId,
      'x-client-secret': clientSecret,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ GSTIN: gstin })
  });
  const data = await res.json().catch(function () { return {}; });
  return { ok: res.ok && data.valid === true, data: data };
}

module.exports = { verifyGstin: verifyGstin };
