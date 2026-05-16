// Cloud auth — Google Sign-In on native, swap a Google ID token for our session JWT.
//
// Flow:
//   user taps "Back up progress" → signIn()
//   → SocialLogin.login({ provider: 'google' }) returns Google ID token
//   → POST /auth/google { idToken } → server returns { userId, nickname, sessionToken }
//   → store all three in localStorage
//   → caller can now call apiGet('/sync/pull') etc.

import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { apiPost, apiDelete, ApiError } from './api.js';
import { WEB_CLIENT_ID, LS_KEYS } from './config.js';

let _initialized = false;

async function ensureInitialized() {
  if (_initialized) return;
  if (!Capacitor.isNativePlatform()) {
    _initialized = true; // SocialLogin no-ops in web; we don't try sign-in there
    return;
  }
  await SocialLogin.initialize({
    google: {
      webClientId: WEB_CLIENT_ID,
    },
  });
  _initialized = true;
}

// ── Public API ────────────────────────────────────────────────────────────

export function isSignedIn() {
  try {
    return localStorage.getItem(LS_KEYS.signedIn) === '1'
      && !!localStorage.getItem(LS_KEYS.sessionToken);
  } catch { return false; }
}

export function getCurrentUser() {
  if (!isSignedIn()) return null;
  try {
    return {
      userId:   localStorage.getItem(LS_KEYS.userId),
      nickname: localStorage.getItem(LS_KEYS.nickname),
    };
  } catch { return null; }
}

// Triggers the native Google Sign-In sheet, then exchanges ID token for our session.
// Returns { userId, nickname } on success, or throws an Error whose .message is
// a *stage-tagged* short string we can show to the user for debugging.
//
// Stages: init / google_signin / no_id_token / server / cancelled
export async function signIn() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('signin: native_only');
  }

  // 1. Plugin init
  try {
    await ensureInitialized();
  } catch (e) {
    console.warn('[auth] init failed:', e);
    throw new Error('init: ' + shortReason(e));
  }

  // 2. Google Sign-In dialog
  let result;
  try {
    result = await SocialLogin.login({
      provider: 'google',
      options: { scopes: ['profile', 'email'] },
    });
  } catch (e) {
    console.warn('[auth] google signin failed:', e);
    if (e?.code === 'USER_CANCELLED' || /cancel/i.test(e?.message || '')) {
      throw new Error('cancelled');
    }
    throw new Error('google: ' + shortReason(e));
  }

  const idToken = result?.result?.idToken;
  if (!idToken) {
    console.warn('[auth] no id token in result:', result);
    throw new Error('no_id_token (responseType=' + (result?.result?.responseType ?? '?') + ')');
  }

  // 3. Exchange with our worker
  let resp;
  try {
    resp = await apiPost('/auth/google', { idToken }, { auth: false });
  } catch (e) {
    console.warn('[auth] server exchange failed:', e);
    throw new Error('server: ' + shortReason(e));
  }
  if (!resp?.sessionToken) throw new Error('server: no_session_token');

  try {
    localStorage.setItem(LS_KEYS.sessionToken, resp.sessionToken);
    localStorage.setItem(LS_KEYS.userId,       resp.userId);
    localStorage.setItem(LS_KEYS.nickname,     resp.nickname);
    localStorage.setItem(LS_KEYS.signedIn,     '1');
  } catch { /* localStorage full — caller can still proceed using returned values */ }

  return { userId: resp.userId, nickname: resp.nickname };
}

function shortReason(e) {
  if (!e) return 'unknown';
  if (typeof e === 'string') return e.slice(0, 60);
  const parts = [];
  if (e.code) parts.push('code=' + e.code);
  if (e.status) parts.push('status=' + e.status);
  if (e.message) parts.push(String(e.message).slice(0, 60));
  return parts.join(' ') || 'unknown';
}

// Signs out locally. We don't call Google's signOut by default — most users
// expect "sign out from Shabd" not "kill Google session". Call wipeCloudData()
// separately if they also want to delete their server data.
export async function signOut() {
  try {
    if (Capacitor.isNativePlatform() && _initialized) {
      await SocialLogin.logout({ provider: 'google' }).catch(() => {});
    }
  } finally {
    clearLocalSession();
  }
}

export function clearLocalSession() {
  try {
    localStorage.removeItem(LS_KEYS.sessionToken);
    localStorage.removeItem(LS_KEYS.userId);
    localStorage.removeItem(LS_KEYS.nickname);
    localStorage.removeItem(LS_KEYS.signedIn);
    localStorage.removeItem(LS_KEYS.lastSyncAt);
  } catch { /* ignore */ }
}

// DELETE /account — wipes user_id row (CASCADE clears everything server-side).
export async function deleteCloudAccount() {
  try { await apiDelete('/account'); }
  catch (e) { if (!(e instanceof ApiError && e.status === 401)) throw e; }
  clearLocalSession();
}
