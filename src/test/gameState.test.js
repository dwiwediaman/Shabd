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
const { load, get, save, recordCompletion, saveSession, getSession, getSessionMeta, setSessionMeta, setSetting, setFlag, refreshFreezes } =
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

  it('round-trips through localStorage', () => {
    setSetting('hardMode', true);
    load(); // reload from localStorage
    expect(get().settings.hardMode).toBe(true);
  });
});

describe('setFlag', () => {
  it('sets a flag value', () => {
    setFlag('seenTutorial', true);
    expect(get().flags.seenTutorial).toBe(true);
  });

  it('persists across reload', () => {
    setFlag('seenTutorial', true);
    load();
    expect(get().flags.seenTutorial).toBe(true);
  });
});

describe('refreshFreezes', () => {
  it('resets freeze count to 1 on a new ISO week', () => {
    // Drain the freeze via a skipped day, then call refreshFreezes on a new week
    recordCompletion('en', true, 3, '2026-01-05'); // W02
    recordCompletion('en', true, 2, '2026-01-07'); // skipped 01-06, uses freeze → count=0
    expect(get().freezes.en.count).toBe(0);

    // New week (W03 starts ~Jan 12)
    refreshFreezes('en', '2026-01-12');
    expect(get().freezes.en.count).toBe(1);
  });

  it('does NOT reset freeze within the same ISO week', () => {
    // Start fresh — freeze count is 1
    refreshFreezes('en', '2026-05-09'); // same week as initial
    // Should not double-reset — still 1
    expect(get().freezes.en.count).toBe(1);
  });

  it('tracks hi and en freezes independently', () => {
    // Drain EN freeze
    recordCompletion('en', true, 3, '2026-01-05');
    recordCompletion('en', true, 2, '2026-01-07');
    expect(get().freezes.en.count).toBe(0);
    // HI freeze should still be 1
    expect(get().freezes.hi.count).toBe(1);
  });
});

describe('load — deepMerge with existing state', () => {
  it('merges stored state over defaults without losing new default keys', () => {
    // Store partial state (simulates old app version with missing keys)
    const partial = { settings: { lang: 'hi' } };
    localStorage.setItem('shabd_state_v1', JSON.stringify(partial));
    load();
    // Should have merged lang override
    expect(get().settings.lang).toBe('hi');
    // Should still have default keys that weren't in stored state
    expect(get().settings.sound).toBe(true);
    expect(get().streak).toBeDefined();
  });

  it('falls back to defaults on invalid JSON', () => {
    localStorage.setItem('shabd_state_v1', 'not-valid-json');
    load();
    expect(get().settings.lang).toBe('en');
    expect(get().stats.en.played).toBe(0);
  });
});

// ── Regression: vc86 hint persistence ─────────────────────────────────────
// Hint clicks persist hintsUsed AND the pre-filled letters keyed to the
// current row. On re-entry, the puzzle screen reapplies them only when
// the stored row matches the current row.
describe('sessionMeta — vc86 pendingHints persistence', () => {
  it('round-trips hintsUsed via setSessionMeta', () => {
    setSessionMeta('2026-05-21|en', { hintsUsed: 2 });
    expect(getSessionMeta('2026-05-21|en').hintsUsed).toBe(2);
  });

  it('patch preserves unrelated fields (partial update)', () => {
    setSessionMeta('2026-05-21|en', { hintsUsed: 1, durationMs: 12345 });
    setSessionMeta('2026-05-21|en', { hintsUsed: 2 }); // patch only hintsUsed
    expect(getSessionMeta('2026-05-21|en').durationMs).toBe(12345);
    expect(getSessionMeta('2026-05-21|en').hintsUsed).toBe(2);
  });

  it('persists pendingHints with row + items[{pos, letter}]', () => {
    const pending = { row: 1, items: [{ pos: 2, letter: 'A' }, { pos: 4, letter: 'E' }] };
    setSessionMeta('2026-05-21|en', { hintsUsed: 2, pendingHints: pending });
    load(); // simulate cold start
    expect(getSessionMeta('2026-05-21|en').pendingHints).toEqual(pending);
  });

  it('clearing pendingHints via null patch keeps hintsUsed intact', () => {
    setSessionMeta('2026-05-21|en', {
      hintsUsed: 3,
      pendingHints: { row: 0, items: [{ pos: 1, letter: 'X' }] },
    });
    setSessionMeta('2026-05-21|en', { pendingHints: null });
    expect(getSessionMeta('2026-05-21|en').pendingHints).toBeNull();
    expect(getSessionMeta('2026-05-21|en').hintsUsed).toBe(3);
  });

  it('returns safe defaults for an unseen session', () => {
    expect(getSessionMeta('2026-12-31|en')).toEqual({ hintsUsed: 0, durationMs: null });
  });
});

// ── Regression: vc81 archive sessions persist (so Time Travel restores) ───
describe('saveSession — vc81 archive plays persist', () => {
  it('saves and retrieves an archive session by date|lang key', () => {
    const guesses = [
      { input: 'crane', isCorrect: false, perTileState: ['absent','absent','absent','absent','absent'] },
      { input: 'trace', isCorrect: true,  perTileState: ['correct','correct','correct','correct','correct'] },
    ];
    saveSession('2026-03-14|en', guesses);
    expect(getSession('2026-03-14|en')).toEqual(guesses);
  });

  it('survives cold start via load()', () => {
    const guesses = [{ input: 'bliss', isCorrect: false, perTileState: ['absent','absent','absent','absent','absent'] }];
    saveSession('2026-03-15|en', guesses);
    load();
    expect(getSession('2026-03-15|en')).toEqual(guesses);
  });
});
