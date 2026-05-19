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
import { get, save, getSession, saveSession, setSessionMeta } from '../game/gameState.js';
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
      // Mirror server's score-relevant metadata locally so stats / share
      // / squad rank can be recomputed offline.
      setSessionMeta(key, {
        hintsUsed:  s.hintsUsed ?? 0,
        durationMs: s.durationMs ?? null,
      });
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
//
// Reliability (vc80): on failure, log loudly, retry once with a short backoff,
// and on the final failure set the pendingPush flag so the next boot's
// ensureBackfilled run will push the session even if it's within the 24h
// throttle window. The session itself is already saved to local state by
// the puzzle screen before submit fires, so no data is lost.
export async function submitScore({ date, lang, guesses, hardMode = false, durationMs = null, hintsUsed = 0 }) {
  if (!isSignedIn()) return { skipped: 'not_signed_in' };
  const payload = { date, lang, guesses, hardMode, durationMs, hintsUsed };

  const attempt = async () => apiPost('/scores/submit', payload);

  try {
    return await attempt();
  } catch (firstErr) {
    if (firstErr instanceof ApiError && firstErr.status === 401) {
      clearLocalSession();
      return { error: 'session_expired' };
    }
    console.warn('[submitScore] first attempt failed, retrying in 1.5s', firstErr);
    await new Promise(r => setTimeout(r, 1500));
    try {
      return await attempt();
    } catch (secondErr) {
      // Final failure — log + flag so the next backfill cycle picks it up.
      console.warn('[submitScore] retry also failed; queuing for next push', secondErr);
      try { localStorage.setItem(LS_KEYS.pendingPush, '1'); } catch {}
      return { error: secondErr.code || 'submit_failed' };
    }
  }
}

// ── Public: one-shot "sign in, then backfill + pull" used by every sign-in path ─
// Centralises the post-signIn dance so the Settings, Squads, and deep-link
// flows all sync identically. Returns { pushed, pulled, error? }.
//
// IMPORTANT: signIn() must already have completed before calling this — pass
// a thunk if you want sign-in inside the helper.
export async function syncAfterSignIn() {
  if (!isSignedIn()) return { skipped: 'not_signed_in' };
  const push = await pushAll();
  if (push.error) return { error: push.error };
  const pull = await pullAndMerge();
  if (pull.error) return { error: pull.error };
  try { localStorage.setItem(LS_KEYS.lastBackfillAt, String(Date.now())); } catch {}
  return {
    pushedSessions: push.pushedSessions ?? 0,
    pulledSessions: pull.pulledSessions ?? 0,
    pulledFreezes:  pull.pulledFreezes  ?? 0,
  };
}

// Called from boot: push any local-only sessions to the server, then pull.
// Throttled so we don't hammer the server on every warm start — only does the
// full push once per 24h (or if no successful backfill is on record yet).
// EXCEPTION: if a previous submitScore failed and set pendingPush, we bypass
// the throttle so the missed session catches up promptly.
const BACKFILL_THROTTLE_MS = 24 * 60 * 60 * 1000;
export async function ensureBackfilled() {
  if (!isSignedIn()) return { skipped: 'not_signed_in' };
  const pendingPush = localStorage.getItem(LS_KEYS.pendingPush) === '1';
  const last        = Number(localStorage.getItem(LS_KEYS.lastBackfillAt) || 0);
  if (!pendingPush && last && Date.now() - last < BACKFILL_THROTTLE_MS) {
    // Still pull — server may have newer sessions from other devices
    return await pullAndMerge();
  }
  const result = await syncAfterSignIn();
  // syncAfterSignIn sets lastBackfillAt on success; only then clear the flag
  if (!result.error) {
    try { localStorage.removeItem(LS_KEYS.pendingPush); } catch {}
  }
  return result;
}

// ── Internal helpers ──────────────────────────────────────────────────────

// Decide whether the remote copy of a (date,lang) session should overwrite
// the local one. Local is authoritative for in-progress play, but a remote
// "more complete" session (won, or more attempts) wins so cross-device sync
// actually works. Exported so it's directly testable.
export function shouldAcceptRemote(localGuesses, remoteSession) {
  if (!localGuesses || !localGuesses.length)       return true;   // no local → take remote
  if (!remoteSession.guesses || !remoteSession.guesses.length)
                                                   return false;  // remote has no payload

  const localLast    = localGuesses[localGuesses.length - 1];
  const localWon     = !!localLast?.isCorrect;
  const localAttempt = localGuesses.length;

  // Never let remote downgrade a local win
  if (localWon && !remoteSession.won) return false;

  // Remote is a win and local isn't → take remote (finished on another device)
  if (remoteSession.won && !localWon) return true;

  // Both same win/loss status → take whichever has more attempts (further along)
  if (remoteSession.attempts > localAttempt) return true;

  return false;
}

function collectLocalSessions(state) {
  const out = [];
  const meta = state.sessionMeta || {};
  for (const [key, guesses] of Object.entries(state.sessions || {})) {
    const [date, lang] = key.split('|');
    if (!date || !lang || !Array.isArray(guesses) || !guesses.length) continue;
    const last       = guesses[guesses.length - 1];
    const won        = !!last?.isCorrect;
    const attempts   = guesses.length;
    const sessionMeta = meta[key] || {};
    out.push({
      date, lang, guesses,
      won, attempts,
      hardMode:    !!state.settings?.hardMode,
      hintsUsed:   sessionMeta.hintsUsed ?? 0,
      durationMs:  sessionMeta.durationMs ?? null,
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
