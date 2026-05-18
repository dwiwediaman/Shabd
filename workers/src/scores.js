// Score submission with server-side replay (anti-cheat).
//
// The client posts the raw guesses for today's puzzle. The server:
//   1. Determines the target word for (date, lang) via the same deterministic
//      algorithm the client uses (workers/src/wordleReplay.js)
//   2. Replays each guess against that target to compute won/attempts
//   3. Upserts a row in the sessions table (same shape as /sync/push)
//
// This means a client cannot lie about a win — they must actually submit
// guesses that the server can replay into a winning state.

import { replayGuesses } from './wordleReplay.js';

// POST /scores/submit  Bearer  { date, lang, guesses, hardMode?, durationMs? }
// → { won, attempts, target, perGuessStates }
export async function handleScoreSubmit(c) {
  const userId = c.get('userId');
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid_json' }, 400); }

  const { date, lang, guesses, hardMode = false, durationMs = null, hintsUsed = 0 } = body;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return c.json({ error: 'invalid_date' }, 400);
  if (lang !== 'en' && lang !== 'hi')
    return c.json({ error: 'invalid_lang' }, 400);
  if (!Array.isArray(guesses) || guesses.length === 0 || guesses.length > 6)
    return c.json({ error: 'invalid_guesses' }, 400);

  // Optional: refuse submissions for future puzzles (clock-spoofing defense).
  // We allow a 36h window so users in any IST-adjacent timezone can submit.
  const today = todayIstDateString();
  if (date > nextDay(today))
    return c.json({ error: 'future_date' }, 400);

  // ── The replay step — this is the actual anti-cheat ──────────────────────
  let result;
  try {
    result = await replayGuesses(date, lang, guesses);
  } catch (e) {
    console.warn('[scores] replay failed:', e.message);
    return c.json({ error: 'replay_failed', detail: e.message }, 400);
  }

  // ── Persist as a session row, but PROTECT against regression ─────────────
  // Rules (in order):
  //   1. Newer submitted_at required (LWW)
  //   2. Can NEVER overwrite a winning session (you can't unwin)
  //   3. Otherwise: only overwrite if new state is better/longer
  //      (more attempts attempted = more progress through the game)
  const now = Date.now();
  const hintsSafe = Math.max(0, Math.min(6, Number(hintsUsed) | 0));
  await c.env.DB.prepare(`
    INSERT INTO sessions (user_id, puzzle_date, lang, guesses_json, won, attempts,
                          hard_mode, duration_ms, submitted_at, hints_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, puzzle_date, lang) DO UPDATE SET
      guesses_json = excluded.guesses_json,
      won          = excluded.won,
      attempts     = excluded.attempts,
      hard_mode    = excluded.hard_mode,
      duration_ms  = excluded.duration_ms,
      submitted_at = excluded.submitted_at,
      hints_used   = excluded.hints_used
    WHERE excluded.submitted_at > sessions.submitted_at
      AND sessions.won = 0
      AND (excluded.won = 1 OR excluded.attempts > sessions.attempts)
  `).bind(
    userId, date, lang, JSON.stringify(guesses),
    result.won ? 1 : 0, result.attempts, hardMode ? 1 : 0,
    durationMs, now, hintsSafe,
  ).run();

  return c.json({
    won:             result.won,
    attempts:        result.attempts,
    perGuessStates:  result.perGuessStates,
    // We do NOT leak target unless the player has finished (won or out of guesses)
    target:          result.won || result.attempts >= 6 ? result.target : null,
    submittedAt:     now,
  });
}

// ── Small helpers ───────────────────────────────────────────────────────────
function todayIstDateString() {
  const istNow = new Date(Date.now() + 19800 * 1000);
  return istNow.toISOString().slice(0, 10);
}

function nextDay(yyyyMmDd) {
  const t = new Date(yyyyMmDd + 'T00:00:00Z').getTime();
  return new Date(t + 86400000).toISOString().slice(0, 10);
}
