// Tiny fetch wrapper for the Shabd API.
//
// - Adds Authorization: Bearer <sessionToken> when present
// - Surfaces network errors as { networkError: true }
// - Returns parsed JSON on success
// - Throws ApiError on non-2xx so callers can `try/catch` cleanly

import { API_BASE, LS_KEYS } from './config.js';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `http_${status}`);
    this.status = status;
    this.body   = body;
    this.code   = body?.error || `http_${status}`;
  }
}

function getToken() {
  try { return localStorage.getItem(LS_KEYS.sessionToken) || null; }
  catch { return null; }
}

// Generic JSON call. opts: { method, path, body, auth (true|false), timeoutMs }
export async function call(opts) {
  const { method = 'GET', path, body, auth = true, timeoutMs = 12000 } = opts;
  if (!path || !path.startsWith('/')) throw new Error('api.call: path must start with /');

  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (!token) throw new ApiError(401, { error: 'no_session' });
    headers.Authorization = `Bearer ${token}`;
  }

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const err = new ApiError(0, { error: 'network_error' });
    err.networkError = true;
    err.cause = e;
    throw err;
  }
  clearTimeout(timer);

  let parsed = null;
  try { parsed = await res.json(); } catch { /* empty body is OK for 204 */ }

  if (!res.ok) throw new ApiError(res.status, parsed);
  return parsed;
}

// Convenience helpers
export const apiGet    = (path, opts)       => call({ method: 'GET',    path, ...opts });
export const apiPost   = (path, body, opts) => call({ method: 'POST',   path, body, ...opts });
export const apiDelete = (path, opts)       => call({ method: 'DELETE', path, ...opts });
