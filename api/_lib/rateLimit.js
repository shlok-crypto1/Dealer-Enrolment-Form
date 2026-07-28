// Best-effort, per-instance rate limiter. Vercel can run more than one warm
// instance of a function at once, so each limiter's map is not a shared,
// global count across all traffic — it stops the common case (same
// client/instance hammering the endpoint) but is not a hard guarantee under
// scale-out. For a strict global cap, back this with a shared store (Vercel
// KV, Upstash Redis, etc.) instead of an in-memory Map.

function createLimiter(windowMs, maxRequests) {
  const hits = new Map();

  return function checkAndRecord(key) {
    const now = Date.now();
    const recent = (hits.get(key) || []).filter(function (t) { return now - t < windowMs; });

    if (recent.length >= maxRequests) {
      hits.set(key, recent);
      return { allowed: false, retryAfterMs: windowMs - (now - recent[0]) };
    }

    recent.push(now);
    hits.set(key, recent);
    return { allowed: true };
  };
}

module.exports = { createLimiter: createLimiter };
