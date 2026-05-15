// Google Sign-In ID token verification.
//
// Flow:
//   Client gets ID token from Google → POSTs to /auth/google
//   Worker fetches Google's JWKS (cached ~12h) → verifies signature
//   Worker verifies issuer + audience + expiry
//   Worker upserts user (by Google sub) → mints our session JWT
//   Returns { userId, nickname, sessionToken } to client

import { signJwt, verifyJwt } from './jwt.js';

const GOOGLE_JWKS_URL  = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISS       = ['https://accounts.google.com', 'accounts.google.com'];

// In-memory JWKS cache (Workers V8 isolate is reused for many requests).
// 12-hour TTL — Google's keys rotate roughly daily.
let _jwksCache = { keys: null, fetchedAt: 0 };
const JWKS_TTL_MS = 12 * 60 * 60 * 1000;

async function fetchJwks() {
  const now = Date.now();
  if (_jwksCache.keys && now - _jwksCache.fetchedAt < JWKS_TTL_MS) {
    return _jwksCache.keys;
  }
  const res = await fetch(GOOGLE_JWKS_URL);
  if (!res.ok) throw new Error('jwks_fetch_failed');
  const data = await res.json();
  _jwksCache = { keys: data.keys, fetchedAt: now };
  return data.keys;
}

// Decode base64url → ArrayBuffer
function b64UrlToBytes(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64UrlToString(str) {
  return new TextDecoder().decode(b64UrlToBytes(str));
}

// Verify a Google ID token. Returns the decoded payload if valid, else throws.
export async function verifyGoogleIdToken(idToken, expectedAudience) {
  if (!idToken || typeof idToken !== 'string') throw new Error('invalid_token');
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('invalid_token_format');

  const [headerB64, payloadB64, sigB64] = parts;
  const header  = JSON.parse(b64UrlToString(headerB64));
  const payload = JSON.parse(b64UrlToString(payloadB64));

  // 1. Find the matching key from JWKS by kid
  const keys = await fetchJwks();
  const jwk  = keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error('unknown_kid');
  if (jwk.alg && jwk.alg !== header.alg) throw new Error('alg_mismatch');
  if (header.alg !== 'RS256') throw new Error('unsupported_alg');

  // 2. Import the public key
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  // 3. Verify the signature
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    b64UrlToBytes(sigB64),
    signingInput,
  );
  if (!ok) throw new Error('bad_signature');

  // 4. Verify claims
  const now = Math.floor(Date.now() / 1000);
  if (!GOOGLE_ISS.includes(payload.iss)) throw new Error('bad_issuer');
  if (payload.aud !== expectedAudience)  throw new Error('bad_audience');
  if (payload.exp && payload.exp < now)  throw new Error('expired');
  if (payload.iat && payload.iat > now + 300) throw new Error('future_iat'); // clock skew
  if (!payload.sub) throw new Error('missing_sub');
  if (!payload.email_verified) throw new Error('email_not_verified');

  return payload;
}

// ── Auth route handler ──────────────────────────────────────────────────────
// POST /auth/google  { idToken } → { userId, nickname, sessionToken }
export async function handleGoogleAuth(c) {
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid_json' }, 400); }
  const idToken = body?.idToken;
  if (!idToken) return c.json({ error: 'missing_idToken' }, 400);

  let claims;
  try {
    claims = await verifyGoogleIdToken(idToken, c.env.GOOGLE_CLIENT_ID);
  } catch (e) {
    console.warn('[auth] verify failed:', e.message);
    return c.json({ error: 'invalid_id_token', detail: e.message }, 401);
  }

  const googleSub = claims.sub;
  const db        = c.env.DB;
  const now       = Date.now();

  // Upsert user by google_sub
  let user = await db
    .prepare('SELECT user_id, nickname FROM users WHERE google_sub = ?')
    .bind(googleSub)
    .first();

  if (!user) {
    const userId   = crypto.randomUUID();
    const nickname = body.nickname?.trim() || derivedNickname(claims) || `Player${userId.slice(0, 4)}`;
    await db
      .prepare(`INSERT INTO users (user_id, google_sub, nickname, created_at, last_sync_at)
                VALUES (?, ?, ?, ?, ?)`)
      .bind(userId, googleSub, nickname, now, now)
      .run();
    user = { user_id: userId, nickname };
  } else {
    await db
      .prepare('UPDATE users SET last_sync_at = ? WHERE user_id = ?')
      .bind(now, user.user_id)
      .run();
  }

  const sessionToken = await signJwt(
    { sub: user.user_id },
    c.env.SESSION_JWT_SECRET,
  );

  return c.json({
    userId:       user.user_id,
    nickname:     user.nickname,
    sessionToken,
  });
}

// Pull a sensible default nickname from the email local-part (no PII stored).
function derivedNickname(claims) {
  if (!claims.email) return null;
  const local = claims.email.split('@')[0];
  // Strip dots/numbers, take first 16 chars, capitalize
  const clean = local.replace(/[^a-zA-Z]/g, '').slice(0, 16);
  if (!clean) return null;
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

// ── Middleware: require valid session token ─────────────────────────────────
// Use as: app.use('/sync/*', requireAuth)
export async function requireAuth(c, next) {
  const authHeader = c.req.header('Authorization') || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return c.json({ error: 'missing_auth' }, 401);

  const claims = await verifyJwt(m[1], c.env.SESSION_JWT_SECRET);
  if (!claims?.sub) return c.json({ error: 'invalid_session' }, 401);

  c.set('userId', claims.sub);
  await next();
}

// ── Account deletion (GDPR/DPDP right-to-delete) ────────────────────────────
// DELETE /account  Bearer <token>
export async function handleAccountDelete(c) {
  const userId = c.get('userId');
  await c.env.DB.prepare('DELETE FROM users WHERE user_id = ?').bind(userId).run();
  // Cascade clears sessions, freezes, prefs, squads owned, squad_members, auth_nonces
  return c.json({ ok: true });
}
