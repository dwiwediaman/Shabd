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

  it('includes shabd.in link', () => {
    expect(renderShareGrid(puzzle, [])).toContain('shabd.in');
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
