import { describe, it, expect } from 'vitest';
import { shouldAcceptRemote } from '../cloud/sync.js';

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
