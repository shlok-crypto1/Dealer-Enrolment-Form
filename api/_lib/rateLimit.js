// Best-effort, per-instance rate limiter. Vercel can run more than one warm
// instance of a function at once, so this map is not a shared, global count
// across all traffic — it stops the common case (same client/instance
// hammering the endpoint) but is not a hard guarantee under scale-out. For a
// strict global cap, back this with a shared store (Vercel KV, Upstash
// Redis, etc.) instead of this in-memory Map.

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 3;
const hits = new Map();

function checkAndRecord(key) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter(function (t) { return now - t < WINDOW_MS; });

  if (recent.length >= MAX_REQUESTS) {
    hits.set(key, recent);
    return { allowed: false, retryAfterMs: WINDOW_MS - (now - recent[0]) };
  }

  recent.push(now);
  hits.set(key, recent);
  return { allowed: true };
}

module.exports = { checkAndRecord: checkAndRecord };
