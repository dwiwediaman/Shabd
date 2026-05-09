import { describe, it, expect } from 'vitest';
import {
  computeTileStates,
  splitTiles,
  TILE_CORRECT,
  TILE_PRESENT,
  TILE_ABSENT,
} from '../game/wordleMechanic.js';

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
