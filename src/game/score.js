// Squad leaderboard scoring — single source of truth for "what is this
// puzzle attempt worth in points?". Must stay in sync with
// workers/src/score.js (server runs the same formula for ranking).
//
// Formula (vc98+):
//   score = 0                                                                   if lost or didn't play
//         = max(1, (7 - attempts) + hardBonus - hintsUsed - wordHintCost)         if won
//   where  hardBonus    = 1 if hardMode else 0
//          wordHintCost = 2 if wordHintUsed else 0
//
// In one sentence for users: "Each guess saved earns a point. Hard mode
// adds one. Each letter hint costs one. A topic hint costs two. A win
// is always worth at least 1."

export const MAX_SCORE_PER_PUZZLE = 7;  // 1 attempt + hard mode + 0 hints

// Compute a single puzzle's score. Accepts a partial session object so it
// works for both the client (gameState session) and server (sessions row).
//
//   puzzleScore({ won, attempts, hardMode, hintsUsed, wordHintUsed })
//
// Behaviour:
//   - won === false       → 0
//   - won === true        → max(1, (7 - attempts) + hardBonus - hintsUsed - wordHintCost)
//   - missing/invalid won → 0  (treat as "didn't play")
//   - hintsUsed defaults to 0 (historical sessions pre-hints-tracking)
//   - wordHintUsed defaults to false (historical sessions pre-vc98)
//   - attempts is clamped to 1..6 defensively (shouldn't happen but safe)
export function puzzleScore({ won, attempts, hardMode, hintsUsed, wordHintUsed } = {}) {
  if (!won) return 0;
  // Clamp attempts to 1..6 explicitly. `|| 6` would treat attempts=0 as
  // missing-input and default to 6 — wrong; 0 should clamp UP to 1.
  const aRaw = Number(attempts);
  const a = Number.isFinite(aRaw) ? Math.max(1, Math.min(6, aRaw)) : 6;
  const hRaw = Number(hintsUsed);
  const h = Number.isFinite(hRaw) ? Math.max(0, hRaw) : 0;
  const bonus = hardMode ? 1 : 0;
  const wordHintCost = wordHintUsed ? 2 : 0;
  return Math.max(1, (7 - a) + bonus - h - wordHintCost);
}

// Sort comparator for leaderboard rows. Higher score wins. Within equal
// scores, the locked tiebreaker order is:
//   1. Fewer attempts
//   2. Hard mode (true beats false)
//   3. Alphabetical by nickname (deterministic, not gameable)
// Players who haven't played sink to the bottom.
export function compareForLeaderboard(a, b) {
  // Bucket: scored > played-but-zero > unplayed
  const aBucket = a.played ? (a.score > 0 ? 0 : 1) : 2;
  const bBucket = b.played ? (b.score > 0 ? 0 : 1) : 2;
  if (aBucket !== bBucket) return aBucket - bBucket;

  if (b.score !== a.score) return b.score - a.score;             // higher first
  if (a.attempts !== b.attempts) {
    // attempts can be null for unplayed — push nulls to back
    if (a.attempts == null) return 1;
    if (b.attempts == null) return -1;
    return a.attempts - b.attempts;                              // fewer first
  }
  if (!!a.hardMode !== !!b.hardMode) return a.hardMode ? -1 : 1; // hard first
  return String(a.nickname || '').localeCompare(String(b.nickname || ''));
}
