// Lightweight HS256 JWT for session tokens — uses Web Crypto API (works in Workers).
// We deliberately don't pull in a JWT library to keep the bundle tiny.

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64UrlEncode(bytes) {
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64UrlEncodeStr(s) {
  return b64UrlEncode(enc.encode(s));
}

async function importKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

// ── Public API ────────────────────────────────────────────────────────────
// signJwt({ sub: userId, ... }, secret, ttlSeconds?) → string
export async function signJwt(claims, secret, ttlSeconds = 60 * 60 * 24 * 30) {
  const header  = { alg: 'HS256', typ: 'JWT' };
  const now     = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + ttlSeconds, ...claims };

  const headerB64  = b64UrlEncodeStr(JSON.stringify(header));
  const payloadB64 = b64UrlEncodeStr(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signingInput));
  const sigB64 = b64UrlEncode(new Uint8Array(sig));

  return `${signingInput}.${sigB64}`;
}

// verifyJwt(token, secret) → claims | null
export async function verifyJwt(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;

  let claims;
  try {
    claims = JSON.parse(dec.decode(b64UrlDecode(payloadB64)));
  } catch { return null; }

  if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return null;

  try {
    const key = await importKey(secret);
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      b64UrlDecode(sigB64),
      enc.encode(signingInput),
    );
    return ok ? claims : null;
  } catch { return null; }
}
