import { describe, it, expect } from 'vitest';
import { puzzleScore, compareForLeaderboard, MAX_SCORE_PER_PUZZLE } from '../game/score.js';

describe('puzzleScore — the documented formula', () => {
  it('rewards 1-attempt easy-mode wins with 6 points', () => {
    expect(puzzleScore({ won: true, attempts: 1, hardMode: false, hintsUsed: 0 })).toBe(6);
  });

  it('rewards 1-attempt hard-mode wins with the max of 7 points', () => {
    expect(puzzleScore({ won: true, attempts: 1, hardMode: true, hintsUsed: 0 })).toBe(7);
    expect(MAX_SCORE_PER_PUZZLE).toBe(7);
  });

  it('matches the design-doc examples exactly', () => {
    // (7 - attempts) + hardBonus - hints, floored at 1 for wins
    expect(puzzleScore({ won: true, attempts: 3, hardMode: false, hintsUsed: 0 })).toBe(4);
    expect(puzzleScore({ won: true, attempts: 3, hardMode: true,  hintsUsed: 0 })).toBe(5);
    expect(puzzleScore({ won: true, attempts: 3, hardMode: true,  hintsUsed: 1 })).toBe(4);
  });

  it('floors a hint-heavy win at 1 (a win is always worth at least 1)', () => {
    expect(puzzleScore({ won: true, attempts: 6, hardMode: false, hintsUsed: 2 })).toBe(1);
    expect(puzzleScore({ won: true, attempts: 6, hardMode: false, hintsUsed: 99 })).toBe(1);
  });

  it('returns 0 for losses and non-plays', () => {
    expect(puzzleScore({ won: false, attempts: 6 })).toBe(0);
    expect(puzzleScore({})).toBe(0);
    expect(puzzleScore()).toBe(0);
  });

  // ── vc98 word/topic hint ─────────────────────────────────────────────
  it('word hint costs 2 points', () => {
    // Easy-mode 3-attempt win = 4. With wordHint = 4 - 2 = 2.
    expect(puzzleScore({ won: true, attempts: 3, hardMode: false, hintsUsed: 0, wordHintUsed: true })).toBe(2);
  });

  it('word hint stacks with letter hints', () => {
    // 3 attempts, 1 letter hint (-1), word hint (-2) → 4 - 1 - 2 = 1
    expect(puzzleScore({ won: true, attempts: 3, hardMode: false, hintsUsed: 1, wordHintUsed: true })).toBe(1);
  });

  it('word hint plus hard mode stays at min-1 floor on worst case', () => {
    // 6 attempts, hard mode (+1), 3 letter hints (-3), word hint (-2)
    // = (7-6) + 1 - 3 - 2 = -3, floored to 1 for a win
    expect(puzzleScore({ won: true, attempts: 6, hardMode: true, hintsUsed: 3, wordHintUsed: true })).toBe(1);
  });

  it('wordHintUsed defaults to false (back-compat with historical sessions)', () => {
    expect(puzzleScore({ won: true, attempts: 2, hardMode: false, hintsUsed: 0 }))
      .toBe(puzzleScore({ won: true, attempts: 2, hardMode: false, hintsUsed: 0, wordHintUsed: false }));
  });

  it('treats missing hintsUsed as 0 (historical pre-vc76 sessions)', () => {
    expect(puzzleScore({ won: true, attempts: 4, hardMode: false })).toBe(3);
    expect(puzzleScore({ won: true, attempts: 4, hardMode: true })).toBe(4);
  });

  it('defends against junk input', () => {
    // attempts clamped to 1..6
    expect(puzzleScore({ won: true, attempts: 0, hardMode: false })).toBe(6);
    expect(puzzleScore({ won: true, attempts: 99, hardMode: false })).toBe(1);
    // negative hints can't help you
    expect(puzzleScore({ won: true, attempts: 3, hintsUsed: -5 })).toBe(4);
  });
});

describe('compareForLeaderboard — sort order', () => {
  // helper
  const row = (overrides = {}) => ({
    nickname: 'X', played: true, won: true, attempts: 3, hardMode: false,
    score: 4, isMe: false, ...overrides,
  });

  it('ranks higher scores first', () => {
    const winners = [row({ nickname: 'A', score: 3 }), row({ nickname: 'B', score: 6 })];
    winners.sort(compareForLeaderboard);
    expect(winners.map(r => r.nickname)).toEqual(['B', 'A']);
  });

  it('breaks ties on fewer attempts', () => {
    const eq = [
      row({ nickname: 'A', score: 4, attempts: 4 }),
      row({ nickname: 'B', score: 4, attempts: 2 }),  // attempts 2 win even at same score — but score should differ; force equal score
    ];
    eq.sort(compareForLeaderboard);
    expect(eq.map(r => r.nickname)).toEqual(['B', 'A']);
  });

  it('breaks attempt-ties on hard mode', () => {
    const eq = [
      row({ nickname: 'A', score: 4, attempts: 3, hardMode: false }),
      row({ nickname: 'B', score: 4, attempts: 3, hardMode: true }),
    ];
    eq.sort(compareForLeaderboard);
    expect(eq.map(r => r.nickname)).toEqual(['B', 'A']);
  });

  it('breaks total ties alphabetically by nickname', () => {
    const eq = [
      row({ nickname: 'Zara', score: 4, attempts: 3 }),
      row({ nickname: 'Aman', score: 4, attempts: 3 }),
    ];
    eq.sort(compareForLeaderboard);
    expect(eq.map(r => r.nickname)).toEqual(['Aman', 'Zara']);
  });

  it('puts losses behind wins, unplayed last', () => {
    const mixed = [
      row({ nickname: 'Unplayed', played: false, won: false, attempts: null, score: 0 }),
      row({ nickname: 'Loser',    played: true,  won: false, attempts: 6,    score: 0 }),
      row({ nickname: 'Winner',   played: true,  won: true,  attempts: 4,    score: 3 }),
    ];
    mixed.sort(compareForLeaderboard);
    expect(mixed.map(r => r.nickname)).toEqual(['Winner', 'Loser', 'Unplayed']);
  });

  // Regression: previous server logic sorted losses by submittedAt — design
  // dropped that. Within a tied bucket, only nickname differentiates.
  it('regression: two losses with same attempts tie on nickname', () => {
    const losses = [
      row({ nickname: 'Bilal', played: true, won: false, attempts: 6, score: 0 }),
      row({ nickname: 'Aarav', played: true, won: false, attempts: 6, score: 0 }),
    ];
    losses.sort(compareForLeaderboard);
    expect(losses.map(r => r.nickname)).toEqual(['Aarav', 'Bilal']);
  });
});
