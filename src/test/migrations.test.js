import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory localStorage so the migration's idempotency key can be set/read.
const lsStore = {};
global.localStorage = {
  getItem:    (k) => lsStore[k] ?? null,
  setItem:    (k, v) => { lsStore[k] = String(v); },
  removeItem: (k) => { delete lsStore[k]; },
  clear:      () => { Object.keys(lsStore).forEach(k => delete lsStore[k]); },
};

// crypto.subtle.digest is used by getDailySeed. Node 22 has WebCrypto by
// default, but be defensive in case the test environment is bare.
if (!globalThis.crypto?.subtle) {
  const { webcrypto } = await import('node:crypto');
  globalThis.crypto = webcrypto;
}

// Mock the word DB so generate() returns deterministic targets we control.
vi.mock('../game/wordDb.js', () => {
  const pool = Array.from({ length: 100 }, (_, i) => ({ word: `w${i}`, frequency_rank: i }));
  return {
    getDailyPool: (_lang, tier) => tier === 'common' ? pool : [],
    isValidGuess: () => true,
  };
});

const { load, get, save, saveSession, setSessionMeta } =
  await import('../game/gameState.js');
const { migrateLegacyArchiveSessions, clearStaleArchiveFlagsFromDailyCompletions } =
  await import('../migrations.js');
const { LS_KEYS } = await import('../cloud/config.js');

const MIGRATION_KEY = 'shabd_migration_perm_algo_v1';
const STALE_ARCHIVE_FLAG_KEY = 'shabd_migration_stale_archive_flag_v1';

beforeEach(() => {
  localStorage.clear();
  load();
});

describe('migrateLegacyArchiveSessions — vc88', () => {
  it('is a no-op when there are no sessions and sets the idempotency key', async () => {
    const r = await migrateLegacyArchiveSessions();
    expect(r.removed).toBe(0);
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('1');
  });

  it('skips if already run (idempotency key set)', async () => {
    localStorage.setItem(MIGRATION_KEY, '1');
    saveSession('2026-01-15|en', [{ input: 'whatever', isCorrect: false, perTileState: [] }]);
    await migrateLegacyArchiveSessions();
    // Session untouched because migration short-circuits
    expect(get().sessions['2026-01-15|en']).toBeDefined();
  });

  it('leaves algo-era sessions (day >= 132) alone', async () => {
    // Day 132 → 2026-05-12
    saveSession('2026-05-12|en', [{ input: 'foo', isCorrect: false, perTileState: [] }]);
    await migrateLegacyArchiveSessions();
    expect(get().sessions['2026-05-12|en']).toBeDefined();
  });

  it('removes a legacy-era session whose target shifted under the new algo', async () => {
    // Day 5 → 2026-01-05 — almost certainly different under old vs new algo
    saveSession('2026-01-05|en', [{ input: 'foo', isCorrect: false, perTileState: [] }]);
    setSessionMeta('2026-01-05|en', { hintsUsed: 2 });
    const r = await migrateLegacyArchiveSessions();
    expect(r.removed).toBeGreaterThanOrEqual(1);
    expect(get().sessions['2026-01-05|en']).toBeUndefined();
    // Meta is cleaned up too so Time Travel sees a clean not-played cell.
    expect(get().sessionMeta['2026-01-05|en']).toBeUndefined();
  });

  it('removes ALL legacy-era sessions across many days (no false-keeps in this fixture)', async () => {
    // With pool size 100 and ~131 days, virtually every old vs new comparison
    // differs. We assert "vast majority removed" rather than 100% to stay
    // robust against the rare coincidental match.
    for (let day = 1; day < 132; day++) {
      const date = new Date(Date.UTC(2026, 0, 1) + (day - 1) * 86400000)
        .toISOString().slice(0, 10);
      saveSession(`${date}|en`, [{ input: 'x', isCorrect: false, perTileState: [] }]);
    }
    const before = Object.keys(get().sessions).length;
    const r = await migrateLegacyArchiveSessions();
    const after = Object.keys(get().sessions).length;
    expect(before).toBe(131);
    expect(after).toBeLessThan(10);             // > 121 removed
    expect(r.removed).toBeGreaterThan(120);
  });

  it('sets the idempotency key after success', async () => {
    saveSession('2026-01-05|en', [{ input: 'x', isCorrect: false, perTileState: [] }]);
    await migrateLegacyArchiveSessions();
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('1');
  });
});

describe('clearStaleArchiveFlagsFromDailyCompletions — vc157', () => {
  it('clears isArchive when the date matches a recorded daily completion (streak.lastDate)', () => {
    const s = get();
    s.streak.en.lastDate = '2026-06-22';
    saveSession('2026-06-22|en', [{ input: 'could', isCorrect: true, perTileState: [] }]);
    setSessionMeta('2026-06-22|en', { isArchive: true });

    const r = clearStaleArchiveFlagsFromDailyCompletions();

    expect(r.cleared).toBe(1);
    expect(get().sessionMeta['2026-06-22|en'].isArchive).toBe(false);
    expect(localStorage.getItem(LS_KEYS.pendingPush)).toBe('1');
    expect(localStorage.getItem(STALE_ARCHIVE_FLAG_KEY)).toBe('1');
  });

  it('leaves isArchive alone when the date does NOT match streak.lastDate (genuine archive-only play)', () => {
    const s = get();
    s.streak.en.lastDate = '2026-06-22'; // most recent daily completion was a different date
    saveSession('2026-05-01|en', [{ input: 'foo', isCorrect: true, perTileState: [] }]);
    setSessionMeta('2026-05-01|en', { isArchive: true });

    const r = clearStaleArchiveFlagsFromDailyCompletions();

    expect(r.cleared).toBe(0);
    expect(get().sessionMeta['2026-05-01|en'].isArchive).toBe(true);
    expect(localStorage.getItem(LS_KEYS.pendingPush)).toBeNull();
  });

  it('is a no-op when there is nothing flagged and sets the idempotency key', () => {
    const r = clearStaleArchiveFlagsFromDailyCompletions();
    expect(r.cleared).toBe(0);
    expect(localStorage.getItem(STALE_ARCHIVE_FLAG_KEY)).toBe('1');
  });

  it('skips entirely if already run (idempotency key set)', () => {
    localStorage.setItem(STALE_ARCHIVE_FLAG_KEY, '1');
    const s = get();
    s.streak.en.lastDate = '2026-06-22';
    saveSession('2026-06-22|en', [{ input: 'could', isCorrect: true, perTileState: [] }]);
    setSessionMeta('2026-06-22|en', { isArchive: true });

    const r = clearStaleArchiveFlagsFromDailyCompletions();

    expect(r.skipped).toBe('done');
    expect(get().sessionMeta['2026-06-22|en'].isArchive).toBe(true); // untouched
  });
});
