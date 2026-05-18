// Squad leaderboard scoring — server-side mirror of src/game/score.js.
// MUST stay in sync with the client. If the formula changes, change both.

// Per-puzzle score:
//   won === false → 0
//   won === true  → max(1, (7 - attempts) + (hardMode ? 1 : 0) - hintsUsed)
export function puzzleScore({ won, attempts, hardMode, hintsUsed } = {}) {
  if (!won) return 0;
  // attempts=0 should clamp UP to 1 (a defensive cap), not be treated
  // as missing input that defaults to the worst-case attempts=6.
  const aRaw = Number(attempts);
  const a = Number.isFinite(aRaw) ? Math.max(1, Math.min(6, aRaw)) : 6;
  const hRaw = Number(hintsUsed);
  const h = Number.isFinite(hRaw) ? Math.max(0, hRaw) : 0;
  const bonus = hardMode ? 1 : 0;
  return Math.max(1, (7 - a) + bonus - h);
}

// Server-side comparator for leaderboard rows. Same rules as client.
export function compareForLeaderboard(a, b) {
  const aBucket = a.played ? (a.score > 0 ? 0 : 1) : 2;
  const bBucket = b.played ? (b.score > 0 ? 0 : 1) : 2;
  if (aBucket !== bBucket) return aBucket - bBucket;

  if (b.score !== a.score) return b.score - a.score;
  if (a.attempts !== b.attempts) {
    if (a.attempts == null) return 1;
    if (b.attempts == null) return -1;
    return a.attempts - b.attempts;
  }
  if (!!a.hardMode !== !!b.hardMode) return a.hardMode ? -1 : 1;
  return String(a.nickname || '').localeCompare(String(b.nickname || ''));
}
