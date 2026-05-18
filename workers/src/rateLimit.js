// Rate-limit helper used by all endpoints (vc78 /squads/preview, vc79+).
//
// Cloudflare's RateLimit binding is "approximate / eventually consistent",
// but raises the cost of abuse significantly. The fail-open optional-chain
// here lets local dev (no binding) keep working without code-paths to maintain.
//
// Returns:
//   - null on success (proceed)
//   - a 429 Response on limit hit (caller should return it directly)
//
// Usage:
//   const limit = await checkRateLimit(c, c.env.RL_PUSH, userId);
//   if (limit) return limit;

export async function checkRateLimit(c, binding, key) {
  if (!binding?.limit || !key) return null;
  const { success } = await binding.limit({ key });
  if (success) return null;
  return c.json({ error: 'rate_limited' }, 429);
}

// Get a stable IP for IP-keyed limits. CF-Connecting-IP is set by Cloudflare
// on the inbound edge — trustworthy. XFF is a fallback for local/dev.
export function clientIp(c) {
  return c.req.header('CF-Connecting-IP')
      || c.req.header('X-Forwarded-For')
      || 'unknown';
}
