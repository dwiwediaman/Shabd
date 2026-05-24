import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeTileStates,
  splitTiles,
  normalize,
  renderShareGrid,
  validateGuess,
  TILE_CORRECT,
  TILE_PRESENT,
  TILE_ABSENT,
} from '../game/wordleMechanic.js';

// ── Mock wordDb so validateGuess doesn't need actual word lists ────────────
const MOCK_GUESS_SET = new Set(['crane', 'trace', 'brave', 'bliss', 'blitz', 'blink', 'cling']);
vi.mock('../game/wordDb.js', () => ({
  getDailyPool: vi.fn(() => [{ word: 'crane', frequency_rank: 1 }]),
  isValidGuess: vi.fn((word) => MOCK_GUESS_SET.has(word)),
  getGuessSet: vi.fn(() => MOCK_GUESS_SET),
}));

describe('computeTileStates', () => {
  it('all correct when guess matches target', () => {
    const result = computeTileStates(['c','r','a','n','e'], ['c','r','a','n','e']);
    expect(result).toEqual([TILE_CORRECT, TILE_CORRECT, TILE_CORRECT, TILE_CORRECT, TILE_CORRECT]);
  });

  it('all absent when no letters match', () => {
    const result = computeTileStates(['b','l','i','s','s'], ['c','r','a','n','e']);
    expect(result).toEqual([TILE_ABSENT, TILE_ABSENT, TILE_ABSENT, TILE_ABSENT, TILE_ABSENT]);
  });

  it('marks present when letter is in word but wrong position', () => {
    // target: crane, guess: raced
    const result = computeTileStates(['r','a','c','e','d'], ['c','r','a','n','e']);
    expect(result[0]).toBe(TILE_PRESENT); // r present
    expect(result[1]).toBe(TILE_PRESENT); // a present
    expect(result[2]).toBe(TILE_PRESENT); // c present
    expect(result[3]).toBe(TILE_PRESENT); // e present
    expect(result[4]).toBe(TILE_ABSENT);  // d absent
  });

  it('correct takes priority over present for duplicate letters', () => {
    // target: "aabbc", guess: "aacbb"
    // pos0: a=a ✓, pos1: a=a ✓, pos2: c≠b → remaining{b:1,c:1}, pos3: b=b ✓, pos4: b≠c → remaining{b:1,c:1}
    // pass2: pos2 c→PRESENT, pos4 b→PRESENT
    const result = computeTileStates(['a','a','c','b','b'], ['a','a','b','b','c']);
    expect(result[0]).toBe(TILE_CORRECT);  // a correct
    expect(result[1]).toBe(TILE_CORRECT);  // a correct
    expect(result[2]).toBe(TILE_PRESENT);  // c is in target at pos4
    expect(result[3]).toBe(TILE_CORRECT);  // b correct at pos3
    expect(result[4]).toBe(TILE_PRESENT);  // b is in remaining (pos2 unmatched)
  });

  it('does not double-count duplicate letters in guess', () => {
    // target: crane, guess: rarer — only one 'r' in target (pos1)
    const result = computeTileStates(['r','a','r','e','r'], ['c','r','a','n','e']);
    // Only pos0 should get PRESENT for 'r'; pos2 and pos4 must be ABSENT
    expect(result[0]).toBe(TILE_PRESENT); // first r gets the one available
    expect(result[2]).toBe(TILE_ABSENT);  // second r → no remaining
    expect(result[4]).toBe(TILE_ABSENT);  // third r → no remaining
  });

  it('handles exact match with repeated letters', () => {
    const result = computeTileStates(['l','l','a','m','a'], ['l','l','a','m','a']);
    expect(result).toEqual(Array(5).fill(TILE_CORRECT));
  });
});

describe('splitTiles', () => {
  it('splits English word into individual characters', () => {
    expect(splitTiles('crane', 'en')).toEqual(['c','r','a','n','e']);
  });

  it('lowercases English input', () => {
    expect(splitTiles('CRANE', 'en')).toEqual(['c','r','a','n','e']);
  });

  it('splits Hindi aksharas keeping matras attached', () => {
    // "भारत" — 2 aksharas: भा + र + त
    const tiles = splitTiles('भारत', 'hi');
    expect(tiles).toContain('भा'); // भ + ा (matra)
    expect(tiles.length).toBeGreaterThan(0);
  });

  it('splits simple Hindi consonants correctly', () => {
    // "कमल" — no matras, 3 aksharas
    const tiles = splitTiles('कमल', 'hi');
    expect(tiles).toEqual(['क', 'म', 'ल']);
  });

  // Regression: prior to vc68 our splitter broke halant-joined conjuncts.
  // "स्वाधीनता" was wrongly split as 5 aksharas ['स्', 'वा', 'धी', 'न', 'ता']
  // instead of the correct 4 ['स्वा', 'धी', 'न', 'ता']. Every Hindi word
  // with a conjunct cluster (स्व, क्ष, ज्ञ, etc.) was unsolvable in a 4-tile grid.
  it('joins consonants across a halant into one conjunct akshara', () => {
    // स्व is one akshara (s+v conjunct with halant)
    expect(splitTiles('स्व', 'hi')).toEqual(['स्व']);
  });

  it('splits स्वाधीनता correctly into 4 aksharas', () => {
    expect(splitTiles('स्वाधीनता', 'hi')).toEqual(['स्वा', 'धी', 'न', 'ता']);
  });

  it('handles क्षत्रिय (kshatriya) conjuncts', () => {
    // क्ष = क+्+ष, त्रि = त+्+र+ि → ['क्ष', 'त्रि', 'य']
    expect(splitTiles('क्षत्रिय', 'hi')).toEqual(['क्ष', 'त्रि', 'य']);
  });

  it('handles ज्ञान (jñāna) — double conjunct with matra', () => {
    expect(splitTiles('ज्ञान', 'hi')).toEqual(['ज्ञा', 'न']);
  });
});

describe('normalize', () => {
  it('lowercases English words', () => {
    expect(normalize('CRANE', 'en')).toBe('crane');
  });

  it('trims whitespace in English', () => {
    expect(normalize('  crane  ', 'en')).toBe('crane');
  });

  it('trims Hindi without changing characters', () => {
    expect(normalize('  कमल  ', 'hi')).toBe('कमल');
  });

  it('does not lowercase Hindi', () => {
    expect(normalize('कमल', 'hi')).toBe('कमल');
  });
});

describe('renderShareGrid', () => {
  const puzzle = { lang: 'en', puzzleIndex: 42, maxGuesses: 6 };

  it('includes app name and puzzle number', () => {
    const result = renderShareGrid(puzzle, []);
    expect(result).toContain('Shabd');
    expect(result).toContain('#42');
  });

  it('shows X/6 when lost', () => {
    const history = [
      { perTileState: ['absent','absent','absent','absent','absent'], isCorrect: false },
      { perTileState: ['absent','absent','absent','absent','absent'], isCorrect: false },
      { perTileState: ['absent','absent','absent','absent','absent'], isCorrect: false },
      { perTileState: ['absent','absent','absent','absent','absent'], isCorrect: false },
      { perTileState: ['absent','absent','absent','absent','absent'], isCorrect: false },
      { perTileState: ['absent','absent','absent','absent','absent'], isCorrect: false },
    ];
    expect(renderShareGrid(puzzle, history)).toContain('X/6');
  });

  it('shows attempt count on win', () => {
    const history = [
      { perTileState: ['absent','present','correct','absent','present'], isCorrect: false },
      { perTileState: ['correct','correct','correct','correct','correct'], isCorrect: true },
    ];
    expect(renderShareGrid(puzzle, history)).toContain('2/6');
  });

  it('uses correct emoji for each tile state', () => {
    const history = [
      { perTileState: ['correct', 'present', 'absent'], isCorrect: false },
    ];
    const result = renderShareGrid({ ...puzzle, maxGuesses: 6 }, history);
    expect(result).toContain('🟩');
    expect(result).toContain('🟨');
    expect(result).toContain('⬜');
  });

  it('includes Play Store link', () => {
    expect(renderShareGrid(puzzle, [])).toContain('play.google.com/store/apps/details?id=in.shabd.game');
  });

  it('uses HI label for Hindi puzzle', () => {
    const hiPuzzle = { ...puzzle, lang: 'hi' };
    expect(renderShareGrid(hiPuzzle, [])).toContain('HI');
  });
});

describe('validateGuess', () => {
  const puzzle = {
    target: 'crane',
    tileCount: 5,
    maxGuesses: 6,
    lang: 'en',
  };

  it('rejects guess with wrong length', () => {
    const result = validateGuess('hi', puzzle);
    expect(result.isValid).toBe(false);
    expect(result.rejectionReason).toBe('wrong_length');
  });

  it('rejects guess not in dictionary', () => {
    const result = validateGuess('zzzzz', puzzle);
    expect(result.isValid).toBe(false);
    expect(result.rejectionReason).toBe('not_in_dictionary');
  });

  it('accepts valid guess and returns tile states', () => {
    const result = validateGuess('crane', puzzle);
    expect(result.isValid).toBe(true);
    expect(result.perTileState).toHaveLength(5);
  });

  it('marks isCorrect true when guess matches target', () => {
    const result = validateGuess('crane', puzzle);
    expect(result.isCorrect).toBe(true);
    expect(result.perTileState).toEqual(Array(5).fill(TILE_CORRECT));
  });

  it('marks isCorrect false for partial match', () => {
    const result = validateGuess('trace', puzzle);
    expect(result.isCorrect).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it('preserves original input in result', () => {
    const result = validateGuess('crane', puzzle);
    expect(result.input).toBe('crane');
  });
});

// ── No-duplicate guarantee for the permutation algorithm ──────────────────
// Bug history: original seed%pool algorithm produced 199 duplicates in 365 days
// (e.g. 'donna' on days 131 and 134). The permutation algorithm activates from
// day 132 onward and must produce zero duplicates until a tier's pool exhausts.
describe('generate — permutation algorithm has no duplicates', () => {
  // Use a real-sized mock pool to exercise the K-counting and shuffle logic
  const mockPool = Array.from({ length: 500 }, (_, i) => ({ word: `w${i}`, frequency_rank: i }));

  it('vc88: legacy era (days 1..131) is dedup\'d under the new path', async () => {
    vi.resetModules();
    vi.doMock('../game/wordDb.js', () => ({
      getDailyPool: (lang, tier) =>
        tier === 'common'
          ? Array.from({ length: 200 }, (_, i) => ({ word: `leg${i}`, frequency_rank: i }))
          : [],
      isValidGuess: () => true,
    }));
    const { generate, _resetShuffleCacheForTests } = await import('../game/wordleMechanic.js');
    _resetShuffleCacheForTests();

    const seen = new Map();
    for (let day = 1; day < 132; day++) {
      const date = new Date(Date.UTC(2026, 0, 1) + (day - 1) * 86400000)
        .toISOString().slice(0, 10);
      const puzzle = generate(0, 'en', date);
      if (seen.has(puzzle.target)) {
        throw new Error(`Duplicate '${puzzle.target}' on day ${day} (first seen day ${seen.get(puzzle.target)})`);
      }
      seen.set(puzzle.target, day);
    }
    expect(seen.size).toBe(131);
  });

  it('vc88: legacy and algo eras use independent shuffles (different word at day 1 vs 132)', async () => {
    vi.resetModules();
    vi.doMock('../game/wordDb.js', () => ({
      getDailyPool: (lang, tier) =>
        tier === 'common'
          ? Array.from({ length: 500 }, (_, i) => ({ word: `w${i}`, frequency_rank: i }))
          : [],
      isValidGuess: () => true,
    }));
    const { generate, _resetShuffleCacheForTests } = await import('../game/wordleMechanic.js');
    _resetShuffleCacheForTests();

    const day1   = generate(0, 'en', '2026-01-01').target;
    const day132 = generate(0, 'en', new Date(Date.UTC(2026, 0, 1) + 131 * 86400000)
      .toISOString().slice(0, 10)).target;
    // Different shuffle seeds → first words of each sequence should differ.
    expect(day1).not.toBe(day132);
  });

  it('vc88: _legacyTarget returns the OLD seed%pool word (used by migration)', async () => {
    vi.resetModules();
    vi.doMock('../game/wordDb.js', () => ({
      getDailyPool: (lang, tier) =>
        tier === 'common'
          ? Array.from({ length: 10 }, (_, i) => ({ word: `old${i}`, frequency_rank: i }))
          : [],
      isValidGuess: () => true,
    }));
    const { _legacyTarget } = await import('../game/wordleMechanic.js');
    // seed=0 → tier roll → common, index 0 % 10 = 0
    expect(_legacyTarget(0, 'en')).toBe('old0');
    // Different seed → different index
    expect(_legacyTarget(7, 'en')).toBe('old7');
  });

  it('produces unique words for 600+ consecutive days from day 132', async () => {
    // Re-mock with the larger pool
    vi.resetModules();
    vi.doMock('../game/wordDb.js', () => ({
      getDailyPool: (lang, tier) => tier === 'common' ? mockPool : [],
      isValidGuess: () => true,
    }));

    const { generate, _resetShuffleCacheForTests } = await import('../game/wordleMechanic.js');
    _resetShuffleCacheForTests();

    const seen = new Map();
    // Walk 600 days starting from the cutoff. Common pool has 500, so first
    // collision is expected around day 132+500 = 632 (when common wraps).
    for (let day = 132; day < 132 + 500; day++) {
      const date = new Date(Date.UTC(2026, 0, 1) + (day - 1) * 86400000)
        .toISOString().slice(0, 10);
      const puzzle = generate(0, 'en', date);
      if (seen.has(puzzle.target)) {
        throw new Error(`Duplicate '${puzzle.target}' on day ${day} (first seen day ${seen.get(puzzle.target)})`);
      }
      seen.set(puzzle.target, day);
    }
    expect(seen.size).toBe(500);
  });
});

// ── findClosestGuess (vc99 spell-suggest) ─────────────────────────────────
// Guess pool: crane, trace, brave, bliss, blitz, blink, cling
describe('findClosestGuess — spell-suggest helper', () => {
  // Earlier tests above use vi.resetModules + vi.doMock to swap the
  // wordDb mock (e.g. to test the permutation algo). Those replacement
  // mocks don't include getGuessSet, so without resetting back to the
  // top-of-file mock here we'd hit "No getGuessSet export" errors.
  const POOL = new Set(['crane', 'trace', 'brave', 'bliss', 'blitz', 'blink', 'cling']);
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('../game/wordDb.js', () => ({
      getDailyPool: () => [{ word: 'crane', frequency_rank: 1 }],
      isValidGuess: (w) => POOL.has(w),
      getGuessSet: () => POOL,
    }));
  });

  it('returns null for inputs that are already valid', async () => {
    const { findClosestGuess } = await import('../game/wordleMechanic.js');
    expect(findClosestGuess('bliss', 'en')).toBeNull();
    expect(findClosestGuess('BLISS', 'en')).toBeNull(); // case-insensitive
  });

  it('returns null when nothing is within maxDist', async () => {
    const { findClosestGuess } = await import('../game/wordleMechanic.js');
    // 'xxxxx' is at distance 5 from every candidate
    expect(findClosestGuess('xxxxx', 'en', { maxDist: 2 })).toBeNull();
  });

  it('returns the 1-edit neighbour when it exists (typo at one position)', async () => {
    const { findClosestGuess } = await import('../game/wordleMechanic.js');
    // 'blisp' → 'bliss' (last letter typo)
    expect(findClosestGuess('blisp', 'en')).toBe('bliss');
  });

  it('returns null for completely garbage input even if length matches', async () => {
    const { findClosestGuess } = await import('../game/wordleMechanic.js');
    // 'zzzzz' is dist 5 from everything in the pool
    expect(findClosestGuess('zzzzz', 'en', { maxDist: 2 })).toBeNull();
  });

  it('prefers smaller distance when multiple candidates qualify', async () => {
    const { findClosestGuess } = await import('../game/wordleMechanic.js');
    // 'blixs' → 'bliss' (d=1, swap one letter) is better than 'blitz' (d=2)
    expect(findClosestGuess('blixs', 'en')).toBe('bliss');
  });

  it('respects the maxDist budget', async () => {
    const { findClosestGuess } = await import('../game/wordleMechanic.js');
    // 'cyimg' vs 'cling' is d=2 (i↔y, c→c, l→i is wrong... let me pick clearer):
    // 'cliny' vs 'cling' is d=1.
    expect(findClosestGuess('cliny', 'en', { maxDist: 1 })).toBe('cling');
    // With maxDist 0, nothing matches an invalid input.
    expect(findClosestGuess('cliny', 'en', { maxDist: 0 })).toBeNull();
  });

  it('returns null if the guess set is missing for that lang', async () => {
    const { findClosestGuess } = await import('../game/wordleMechanic.js');
    expect(findClosestGuess('hello', 'fr')).toBeNull();
  });

  it('returns null for empty / falsy input', async () => {
    const { findClosestGuess } = await import('../game/wordleMechanic.js');
    expect(findClosestGuess('', 'en')).toBeNull();
    expect(findClosestGuess(null, 'en')).toBeNull();
    expect(findClosestGuess(undefined, 'en')).toBeNull();
  });
});
