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
// Returns { userId, nickname } on success, or throws.
export async function signIn() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('signin_native_only');
  }
  await ensureInitialized();

  const result = await SocialLogin.login({
    provider: 'google',
    options: { scopes: ['profile', 'email'] },
  });
  const idToken = result?.result?.idToken;
  if (!idToken) throw new Error('no_id_token');

  const resp = await apiPost('/auth/google', { idToken }, { auth: false });
  if (!resp?.sessionToken) throw new Error('no_session_token');

  try {
    localStorage.setItem(LS_KEYS.sessionToken, resp.sessionToken);
    localStorage.setItem(LS_KEYS.userId,       resp.userId);
    localStorage.setItem(LS_KEYS.nickname,     resp.nickname);
    localStorage.setItem(LS_KEYS.signedIn,     '1');
  } catch { /* localStorage full — caller can still proceed using returned values */ }

  return { userId: resp.userId, nickname: resp.nickname };
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
