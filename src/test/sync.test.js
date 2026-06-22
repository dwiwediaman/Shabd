import { describe, it, expect } from 'vitest';
import { shouldAcceptRemote, collectLocalSessions } from '../cloud/sync.js';

// Mock localStorage before importing gameState (same pattern as gameState.test.js)
const lsStore = {};
global.localStorage = {
  getItem:    (k) => lsStore[k] ?? null,
  setItem:    (k, v) => { lsStore[k] = v; },
  removeItem: (k) => { delete lsStore[k]; },
  clear:      () => { Object.keys(lsStore).forEach(k => delete lsStore[k]); },
};
const gameState = await import('../game/gameState.js');

// Helpers — build minimal guess arrays / remote sessions
const guesses = (n, winLast = false) => {
  const arr = Array.from({ length: n }, (_, i) => ({ isCorrect: i === n - 1 && winLast }));
  return arr;
};
const remote = (attempts, won) => ({
  guesses: guesses(attempts, won),
  attempts,
  won,
  submittedAt: 1700000000000,
});

describe('shouldAcceptRemote — cross-device merge rules', () => {
  it('takes remote when no local exists (fresh device, backfill from server)', () => {
    expect(shouldAcceptRemote(undefined,   remote(3, true))).toBe(true);
    expect(shouldAcceptRemote([],          remote(3, true))).toBe(true);
    expect(shouldAcceptRemote(null,        remote(3, false))).toBe(true);
  });

  it('never lets remote downgrade a local win', () => {
    // Local won in 3, remote is in-progress at 4 — keep the win
    expect(shouldAcceptRemote(guesses(3, true), remote(4, false))).toBe(false);
  });

  it('takes remote when remote is a win and local is not (finished on another device)', () => {
    // Local in-progress at 2, remote completed with a win at 4
    expect(shouldAcceptRemote(guesses(2, false), remote(4, true))).toBe(true);
  });

  it('takes remote when both incomplete but remote has more attempts', () => {
    // Local 2 guesses, remote has 4 guesses — remote is further along
    expect(shouldAcceptRemote(guesses(2, false), remote(4, false))).toBe(true);
  });

  it('keeps local when both incomplete and local has more attempts', () => {
    expect(shouldAcceptRemote(guesses(5, false), remote(2, false))).toBe(false);
  });

  it('keeps local when both are losses with same attempts (no upgrade)', () => {
    expect(shouldAcceptRemote(guesses(6, false), remote(6, false))).toBe(false);
  });

  it('rejects remote with empty guesses (server has nothing useful)', () => {
    expect(shouldAcceptRemote(guesses(2, false), {
      guesses: [], attempts: 0, won: false, submittedAt: 1700000000000,
    })).toBe(false);
  });

  // Regression: original logic returned false unconditionally when local
  // existed. This made historical sessions from other devices invisible.
  it('regression: pulls historical session that local was missing for that date', () => {
    // Local empty for this date|lang → take remote
    expect(shouldAcceptRemote(undefined, remote(4, true))).toBe(true);
  });
});

describe('collectLocalSessions — excludes sessions tagged isArchive', () => {
  it('excludes a session with isArchive:true', () => {
    const state = {
      settings: { hardMode: false },
      sessions: { '2026-05-01|en': guesses(2, true) },
      sessionMeta: { '2026-05-01|en': { isArchive: true, hintsUsed: 0, durationMs: null } },
    };
    expect(collectLocalSessions(state)).toHaveLength(0);
  });

  it('includes a session with isArchive:false', () => {
    const state = {
      settings: { hardMode: true },
      sessions: { '2026-06-22|en': guesses(3, true) },
      sessionMeta: { '2026-06-22|en': { isArchive: false, hintsUsed: 0, durationMs: null } },
    };
    const out = collectLocalSessions(state);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ date: '2026-06-22', lang: 'en', won: true });
  });
});

// Repro for the real bug: a user opens today's date via Time Travel before
// playing it for real — the Time Travel screen auto-scrolls to today's
// unplayed cell, so this is an easy accidental tap. One guess there tags
// sessionMeta.isArchive = true for that date|lang key. She then backs out
// and finishes the SAME session via the normal Play (daily) flow. The old
// dailyPuzzle.js code only conditionally *added* isArchive:true for archive
// mode and never cleared it for daily mode, so { ...existing, ...patch }
// in setSessionMeta() let the stale true survive forever — silently
// excluding a legitimate win from every future /sync/push with no error.
describe('setSessionMeta — daily-mode completion must clear a stale isArchive flag', () => {
  it('a later daily-mode patch with isArchive:false overrides an earlier archive-mode true', () => {
    gameState.load();
    const key = '2026-06-22|en';
    // Simulates the archive-mode guess (old dailyPuzzle.js: mode === 'archive' branch).
    gameState.setSessionMeta(key, { pendingHints: null, isArchive: true });
    expect(gameState.getSessionMeta(key).isArchive).toBe(true);

    // Simulates the later daily-mode guess with the fix applied: the patch
    // now explicitly sends isArchive: mode === 'archive' (false for daily),
    // instead of omitting the key and relying on the old conditional spread.
    gameState.setSessionMeta(key, { pendingHints: null, isArchive: false });
    expect(gameState.getSessionMeta(key).isArchive).toBe(false);

    gameState.saveSession(key, guesses(3, true));
    const state = gameState.get();
    const out = collectLocalSessions(state);
    expect(out.find(s => s.date === '2026-06-22' && s.lang === 'en')).toBeTruthy();
  });
});
