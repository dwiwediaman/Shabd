import { describe, it, expect, vi } from 'vitest';
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
vi.mock('../game/wordDb.js', () => ({
  getDailyPool: vi.fn(() => [{ word: 'crane', frequency_rank: 1 }]),
  isValidGuess: vi.fn((word) => ['crane', 'trace', 'brave', 'bliss'].includes(word)),
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
