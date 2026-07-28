// Thin wrapper around the Supabase JS client. Uses the service_role key,
// which bypasses Row Level Security — this must only ever run server-side
// (inside /api functions) and must never be imported into client-side code.
const { createClient } = require('@supabase/supabase-js');

let client = null;

function getClient() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return client;
}

module.exports = { getClient: getClient };
