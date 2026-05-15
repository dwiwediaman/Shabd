// Cloud sync — pull server state, merge with local, push local-only data back.
//
// Conflict model:
//   - Sessions are the immutable primitive. Server stores one row per
//     (user, date, lang). Both sides write monotonically.
//   - Stats and streak are DERIVED from sessions — never synced directly.
//   - Last-write-wins on submittedAt for sessions (same rule the server uses).
//   - Server also enforces "can't unwin" — see scores.js / sync.js.

import { apiGet, apiPost, ApiError } from './api.js';
import { isSignedIn, clearLocalSession } from './auth.js';
import { LS_KEYS } from './config.js';
import { get, save, getSession, saveSession } from '../game/gameState.js';
import { Capacitor } from '@capacitor/core';

// ── Public API ────────────────────────────────────────────────────────────

// Pull cloud state, merge with local. Safe to call repeatedly.
// Returns { pulledSessions, pulledFreezes, prefsApplied, error? }.
export async function pullAndMerge() {
  if (!isSignedIn()) return { skipped: 'not_signed_in' };

  let serverState;
  try { serverState = await apiGet('/sync/pull'); }
  catch (e) {
    if (e instanceof ApiError && e.status === 401) { clearLocalSession(); return { error: 'session_expired' }; }
    return { error: e.code || 'pull_failed' };
  }

  const result = { pulledSessions: 0, pulledFreezes: 0, prefsApplied: false };
  const state  = get();

  // ── Sessions ────────────────────────────────────────────────────────────
  for (const s of serverState.sessions || []) {
    const key   = `${s.date}|${s.lang}`;
    const local = getSession(key);
    if (shouldAcceptRemote(local, s)) {
      saveSession(key, s.guesses);  // existing API stores any JSON shape
      result.pulledSessions++;
    }
  }

  // ── Freezes ─────────────────────────────────────────────────────────────
  for (const f of serverState.freezes || []) {
    if (!state.freezes) state.freezes = {};
    if (!state.freezes[f.lang]) state.freezes[f.lang] = { count: 1, weekStart: f.isoWeek };
    // Mark used in current week if server says it's used
    if (f.usedAt && state.freezes[f.lang].weekStart === f.isoWeek) {
      state.freezes[f.lang].count = 0;
    }
    result.pulledFreezes++;
  }

  // ── Prefs (lang, hardMode, seenTutorial) ───────────────────────────────
  if (serverState.prefs) {
    let prefsChanged = false;
    if (serverState.prefs.lang && !state.settings.lang) {
      state.settings.lang = serverState.prefs.lang; prefsChanged = true;
    }
    if (typeof serverState.prefs.hardMode === 'boolean' && state.settings.hardMode == null) {
      state.settings.hardMode = serverState.prefs.hardMode; prefsChanged = true;
    }
    if (serverState.prefs.seenTutorial && !state.flags?.seenTutorial) {
      if (!state.flags) state.flags = {};
      state.flags.seenTutorial = true; prefsChanged = true;
    }
    result.prefsApplied = prefsChanged;
  }

  save();
  try { localStorage.setItem(LS_KEYS.lastSyncAt, String(Date.now())); } catch {}
  return result;
}

// Push local state to the server. Sends only what's needed.
// Returns { pushedSessions, error? }.
export async function pushAll() {
  if (!isSignedIn()) return { skipped: 'not_signed_in' };
  if (!Capacitor.isNativePlatform() && !navigator.onLine) return { skipped: 'offline' };

  const state    = get();
  const sessions = collectLocalSessions(state);
  const freezes  = collectLocalFreezes(state);
  const prefs    = collectLocalPrefs(state);

  if (!sessions.length && !freezes.length && !prefs) return { pushedSessions: 0 };

  try {
    await apiPost('/sync/push', { sessions, freezes, prefs });
    try { localStorage.setItem(LS_KEYS.lastSyncAt, String(Date.now())); } catch {}
    return { pushedSessions: sessions.length };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) { clearLocalSession(); return { error: 'session_expired' }; }
    return { error: e.code || 'push_failed' };
  }
}

// Submit a single game result via the anti-cheat path (server replays guesses).
// Returns { won, attempts, target?, submittedAt } from the server.
// Use this on game end. Falls back to local-only if not signed in / offline.
export async function submitScore({ date, lang, guesses, hardMode = false, durationMs = null }) {
  if (!isSignedIn()) return { skipped: 'not_signed_in' };
  try {
    return await apiPost('/scores/submit', { date, lang, guesses, hardMode, durationMs });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) { clearLocalSession(); return { error: 'session_expired' }; }
    return { error: e.code || 'submit_failed' };
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────

function shouldAcceptRemote(localGuesses, remoteSession) {
  if (!localGuesses || !localGuesses.length) return true;     // no local → take remote
  if (!remoteSession.submittedAt)            return false;   // remote has no timestamp
  // Local doesn't carry submittedAt — be conservative: if local seems newer or equal
  // (already-played today), skip. The server-side LWW guards already protect against
  // wins being clobbered on push.
  return false;
}

function collectLocalSessions(state) {
  const out = [];
  for (const [key, guesses] of Object.entries(state.sessions || {})) {
    const [date, lang] = key.split('|');
    if (!date || !lang || !Array.isArray(guesses) || !guesses.length) continue;
    const last     = guesses[guesses.length - 1];
    const won      = !!last?.isCorrect;
    const attempts = guesses.length;
    out.push({
      date, lang, guesses,
      won, attempts,
      hardMode:    !!state.settings?.hardMode,
      durationMs:  null,
      submittedAt: Date.now(),  // approximate — server preserves first-write timestamp
    });
  }
  return out;
}

function collectLocalFreezes(state) {
  const out = [];
  for (const lang of ['en', 'hi']) {
    const f = state.freezes?.[lang];
    if (!f?.weekStart) continue;
    out.push({
      lang,
      isoWeek: f.weekStart,
      usedAt:  f.count === 0 ? Date.now() : null,
    });
  }
  return out;
}

function collectLocalPrefs(state) {
  if (!state.settings) return null;
  return {
    lang:         state.settings.lang ?? null,
    hardMode:     !!state.settings.hardMode,
    seenTutorial: !!state.flags?.seenTutorial,
  };
}
