// Cloud save endpoints. The client treats local state as primary, the server
// as backup + conflict resolution. Sessions are the immutable primitive —
// stats and streaks are derived client-side from the session list.
//
// Conflict resolution: per (user, puzzle_date, lang), last-write-wins on
// submitted_at. The client only pushes sessions newer than its last sync.
//
// SECURITY (vc78): /sync/push REPLAYS every session's guesses against the
// server-derived target before storing. The client's `won`, `attempts`, and
// `hardMode` claims are ignored — the replay result is authoritative. This
// blocks the trivial cheat where a hostile client posted { won: true,
// attempts: 1 } with arbitrary guesses to inflate squad scores.

import { replayGuesses } from './wordleReplay.js';

const SUBMIT_WINDOW_DAYS = 7;

// GET /sync/pull  Bearer  → { sessions, freezes, prefs, serverNow }
export async function handlePull(c) {
  const userId = c.get('userId');
  const db = c.env.DB;

  const [sessions, freezes, prefs] = await Promise.all([
    db.prepare(`SELECT puzzle_date, lang, guesses_json, won, attempts, hard_mode,
                       duration_ms, submitted_at, hints_used
                FROM sessions WHERE user_id = ?
                ORDER BY puzzle_date DESC LIMIT 500`)
      .bind(userId).all(),
    db.prepare('SELECT lang, iso_week, used_at FROM freezes WHERE user_id = ?')
      .bind(userId).all(),
    db.prepare('SELECT lang, hard_mode, seen_tutorial, updated_at FROM prefs WHERE user_id = ?')
      .bind(userId).first(),
  ]);

  return c.json({
    sessions: (sessions.results || []).map(row => ({
      date:        row.puzzle_date,
      lang:        row.lang,
      guesses:     JSON.parse(row.guesses_json),
      won:         !!row.won,
      attempts:    row.attempts,
      hardMode:    !!row.hard_mode,
      durationMs:  row.duration_ms,
      submittedAt: row.submitted_at,
      hintsUsed:   row.hints_used ?? 0,
    })),
    freezes: (freezes.results || []).map(row => ({
      lang:     row.lang,
      isoWeek:  row.iso_week,
      usedAt:   row.used_at,
    })),
    prefs: prefs ? {
      lang:         prefs.lang,
      hardMode:     !!prefs.hard_mode,
      seenTutorial: !!prefs.seen_tutorial,
      updatedAt:    prefs.updated_at,
    } : null,
    serverNow: Date.now(),
  });
}

// POST /sync/push  Bearer  { sessions?, freezes?, prefs? } → { merged: { sessions, freezes, prefs } }
export async function handlePush(c) {
  const userId = c.get('userId');
  const db = c.env.DB;

  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid_json' }, 400); }

  const { sessions = [], freezes = [], prefs = null } = body;
  if (!Array.isArray(sessions)) return c.json({ error: 'sessions_must_be_array' }, 400);
  if (!Array.isArray(freezes))  return c.json({ error: 'freezes_must_be_array'  }, 400);

  const counts = { sessions: 0, freezes: 0, prefs: 0 };

  // ── Upsert sessions (REPLAY-VALIDATED) ──────────────────────────────────
  // The client cannot be trusted with `won` / `attempts` / `hardMode`.
  // We replay every session server-side; only the replay result is stored.
  // Sessions that fail validation (malformed, out-of-window, dictionary
  // miss, future date) are silently dropped — the rest of the push still
  // succeeds so the user's other sessions aren't blocked by one bad row.
  for (const s of sessions) {
    if (!isValidSession(s)) continue;
    if (!withinSubmitWindow(s.date)) continue;   // H3: drop > 7-day-old sessions

    let replayed;
    try {
      replayed = await replayGuesses(s.date, s.lang, s.guesses.map(g => g.input));
    } catch {
      continue;  // bad guesses / unknown date / pre-launch — skip silently
    }

    // H2: only honour hardMode if the guesses actually obey the constraint.
    const hardModeValid = s.hardMode === true && replayed.hardModeValid !== false;

    // hintsUsed can't be replay-verified, but bound it sensibly: a player
    // can't have used more hints than they made guesses, and historical
    // pre-vc76 sessions default to 0.
    const hintsSafe = Math.max(0, Math.min(replayed.attempts, Number(s.hintsUsed) | 0));

    await db.prepare(`
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
      userId, s.date, s.lang, JSON.stringify(s.guesses),
      replayed.won ? 1 : 0, replayed.attempts, hardModeValid ? 1 : 0,
      s.durationMs ?? null, s.submittedAt, hintsSafe,
    ).run();
    counts.sessions++;
  }

  // ── Upsert freezes ─────────────────────────────────────────────────────
  for (const f of freezes) {
    if (!f.lang || !f.isoWeek) continue;
    await db.prepare(`
      INSERT INTO freezes (user_id, lang, iso_week, used_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, lang, iso_week) DO UPDATE SET
        used_at = COALESCE(excluded.used_at, freezes.used_at)
    `).bind(userId, f.lang, f.isoWeek, f.usedAt ?? null).run();
    counts.freezes++;
  }

  // ── Upsert prefs (single row per user) ─────────────────────────────────
  if (prefs && typeof prefs === 'object') {
    const now = Date.now();
    await db.prepare(`
      INSERT INTO prefs (user_id, lang, hard_mode, seen_tutorial, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        lang          = excluded.lang,
        hard_mode     = excluded.hard_mode,
        seen_tutorial = excluded.seen_tutorial,
        updated_at    = excluded.updated_at
    `).bind(
      userId,
      prefs.lang ?? null,
      prefs.hardMode ? 1 : 0,
      prefs.seenTutorial ? 1 : 0,
      now,
    ).run();
    counts.prefs = 1;
  }

  // Bump user's last_sync_at
  await db.prepare('UPDATE users SET last_sync_at = ? WHERE user_id = ?')
    .bind(Date.now(), userId).run();

  return c.json({ ok: true, accepted: counts, serverNow: Date.now() });
}

// H3: reject score submissions for puzzles more than SUBMIT_WINDOW_DAYS old.
// Closes the "fake-submit 365 past dates" leaderboard-inflation attack.
// Anything older is still preserved locally and pullable from cloud if it
// landed there before vc78, but newly-submitted old sessions are ignored.
export function withinSubmitWindow(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const today = todayIstDateString();
  const t = new Date(today   + 'T00:00:00Z').getTime();
  const d = new Date(dateStr + 'T00:00:00Z').getTime();
  if (d > t) return false;                  // future dates rejected upstream too
  return (t - d) / 86400000 <= SUBMIT_WINDOW_DAYS;
}

function todayIstDateString() {
  const istNow = new Date(Date.now() + 19800 * 1000);
  return istNow.toISOString().slice(0, 10);
}

// Defensive validation — server is the trust boundary
function isValidSession(s) {
  return s
    && typeof s.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date)
    && (s.lang === 'en' || s.lang === 'hi')
    && Array.isArray(s.guesses) && s.guesses.length > 0 && s.guesses.length <= 6
    && Number.isInteger(s.attempts) && s.attempts >= 1 && s.attempts <= 6
    && Number.isInteger(s.submittedAt) && s.submittedAt > 0;
}
