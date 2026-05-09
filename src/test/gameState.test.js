import { describe, it, expect, beforeEach } from 'vitest';

// Mock localStorage before importing gameState
const store = {};
global.localStorage = {
  getItem:    (k) => store[k] ?? null,
  setItem:    (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
  clear:      () => { Object.keys(store).forEach(k => delete store[k]); },
};

// Dynamic import so the mock is in place first
const { load, get, recordCompletion, saveSession, getSession, setSetting } =
  await import('../game/gameState.js');

beforeEach(() => {
  localStorage.clear();
  load(); // reset in-memory state
});

describe('recordCompletion', () => {
  it('increments played count on win', () => {
    recordCompletion('en', true, 3, '2026-05-09');
    expect(get().stats.en.played).toBe(1);
    expect(get().stats.en.won).toBe(1);
  });

  it('increments played but not won on loss', () => {
    recordCompletion('en', false, 6, '2026-05-09');
    expect(get().stats.en.played).toBe(1);
    expect(get().stats.en.won).toBe(0);
  });

  it('records guess distribution slot correctly', () => {
    recordCompletion('en', true, 2, '2026-05-09');
    expect(get().stats.en.dist[1]).toBe(1); // 0-indexed: attempt 2 → slot 1
  });

  it('starts streak at 1 on first win', () => {
    recordCompletion('en', true, 3, '2026-05-09');
    expect(get().streak.en.current).toBe(1);
    expect(get().streak.en.max).toBe(1);
  });

  it('increments streak on consecutive day', () => {
    recordCompletion('en', true, 3, '2026-05-09');
    recordCompletion('en', true, 2, '2026-05-10');
    expect(get().streak.en.current).toBe(2);
    expect(get().streak.en.max).toBe(2);
  });

  it('uses freeze when exactly one day is skipped', () => {
    recordCompletion('en', true, 3, '2026-05-09');
    recordCompletion('en', true, 2, '2026-05-11'); // skipped 05-10 — freeze consumed
    expect(get().streak.en.current).toBe(2);
    expect(get().freezes.en.count).toBe(0);
  });

  it('resets streak when a day is skipped and no freeze available', () => {
    recordCompletion('en', true, 3, '2026-05-09');
    recordCompletion('en', true, 2, '2026-05-11'); // skipped 05-10 — freeze consumed
    // Now skipped again with no freeze left
    recordCompletion('en', true, 2, '2026-05-13'); // skipped 05-12
    expect(get().streak.en.current).toBe(1);
  });

  it('resets streak to 0 on loss', () => {
    recordCompletion('en', true, 3, '2026-05-09');
    recordCompletion('en', false, 6, '2026-05-10');
    expect(get().streak.en.current).toBe(0);
  });

  it('tracks hi and en streaks independently', () => {
    recordCompletion('hi', true, 1, '2026-05-09');
    recordCompletion('hi', true, 1, '2026-05-10');
    recordCompletion('en', true, 1, '2026-05-09');
    expect(get().streak.hi.current).toBe(2);
    expect(get().streak.en.current).toBe(1);
  });
});

describe('saveSession / getSession', () => {
  it('round-trips a session by key', () => {
    const guesses = [{ input: 'crane', perTileState: ['correct','correct','correct','correct','correct'] }];
    saveSession('2026-05-09|en', guesses);
    expect(getSession('2026-05-09|en')).toEqual(guesses);
  });

  it('returns null for unknown session', () => {
    expect(getSession('9999-99-99|en')).toBeNull();
  });
});

describe('setSetting', () => {
  it('persists a setting value', () => {
    setSetting('lang', 'hi');
    expect(get().settings.lang).toBe('hi');
  });
});
