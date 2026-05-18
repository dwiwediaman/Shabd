// Tests for the server-side hard-mode invariant verifier (vc78 / H2).
// Imports directly from the workers/ tree — vitest doesn't care about the
// workers/ vs src/ boundary at module-resolution time.

import { describe, it, expect } from 'vitest';
import { verifyHardModeInvariant } from '../../workers/src/wordleReplay.js';

// Helpers — build inputs that match what replayGuesses passes in
const tiles = (s) => [...s];   // 'crane' → ['c','r','a','n','e']

describe('verifyHardModeInvariant — Wordle hard mode rules', () => {
  it('passes when there is only one guess (nothing to constrain)', () => {
    expect(verifyHardModeInvariant(
      [tiles('crane')],
      [['absent','absent','absent','absent','absent']],
    )).toBe(true);
  });

  it('passes when subsequent guesses keep greens at the right position', () => {
    // target: 'crane'. Guess 1: 'crony' → c✓ r✓ o✗ n✓ y✗.
    // Guess 2 must keep c@0, r@1, n@3 → 'crane' (full match).
    expect(verifyHardModeInvariant(
      [tiles('crony'), tiles('crane')],
      [
        ['correct','correct','absent','correct','absent'],
        ['correct','correct','correct','correct','correct'],
      ],
    )).toBe(true);
  });

  it('fails when a previously-green letter moves position', () => {
    // Guess 1: 'crony' → c✓ at pos 0. Guess 2: 'acorn' moves c to pos 1.
    expect(verifyHardModeInvariant(
      [tiles('crony'), tiles('acorn')],
      [
        ['correct','correct','absent','correct','absent'],
        ['absent','absent','absent','absent','absent'],
      ],
    )).toBe(false);
  });

  it('fails when a previously-yellow letter is dropped entirely', () => {
    // Guess 1: 'audio' against target 'crane' → a yellow at pos 0
    //   (pos 1 of target has 'r', so 'a' isn't there; 'a' IS at pos 2 of
    //    target so it's PRESENT not absent).
    // Guess 2 must include 'a' somewhere; 'blink' doesn't.
    expect(verifyHardModeInvariant(
      [tiles('audio'), tiles('blink')],
      [
        ['present','absent','absent','absent','absent'],
        ['absent','absent','absent','absent','absent'],
      ],
    )).toBe(false);
  });

  it('passes when a previously-yellow letter appears anywhere later', () => {
    expect(verifyHardModeInvariant(
      [tiles('audio'), tiles('actor')],
      [
        ['present','absent','absent','absent','absent'],
        ['correct','present','absent','absent','present'],
      ],
    )).toBe(true);
  });

  it('regression: dropping a green is the most common hard-mode cheat', () => {
    // Target hypothesis 'tales'. Guess 1: 'tares' → t,a,r,e,s with
    // t✓ a✓ r✗ e✓ s✓.  An honest hard-mode guess 2 must keep t@0,a@1,e@3,s@4.
    // A cheating guess 2 'lures' drops t,a,e — violates 3 greens at once.
    expect(verifyHardModeInvariant(
      [tiles('tares'), tiles('lures')],
      [
        ['correct','correct','absent','correct','correct'],
        ['absent','absent','absent','absent','correct'],
      ],
    )).toBe(false);
  });

  it('treats empty inputs as trivially valid', () => {
    expect(verifyHardModeInvariant([], [])).toBe(true);
  });
});
