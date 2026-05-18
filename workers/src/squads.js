// Squads — private leaderboards with invite codes.
//
// A squad has an owner, a name, an invite code (6-char A-Z0-9), and members.
// Max 50 members per squad (enforced here). Leaderboards are computed
// per-day per-lang by joining squad_members against sessions.

import { puzzleScore, compareForLeaderboard } from './score.js';

const MAX_MEMBERS_PER_SQUAD     = 50;
const MAX_SQUADS_PER_USER       = 10;
const MAX_NAME_LEN              = 32;
const INVITE_CODE_ALPHABET      = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
// 8 chars × 32 alphabet ≈ 40 bits of entropy (was 6 chars ≈ 30 bits in
// vc77 and earlier). Existing 6-char codes still validate via the
// /^[A-Z0-9]{4,8}$/ regex on lookup, so legacy share-links keep working.
const INVITE_CODE_LEN           = 8;
const INVITE_CODE_GEN_ATTEMPTS  = 10;

// vc78: replaced Math.random() with crypto.getRandomValues to close C2.1.
// The alphabet length (32) divides 256 evenly so the modulo step has zero
// bias — every byte maps uniformly to one of the 32 chars.
function generateInviteCode() {
  const bytes = new Uint8Array(INVITE_CODE_LEN);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < INVITE_CODE_LEN; i++) {
    out += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length];
  }
  return out;
}

// POST /squads/create  Bearer  { name } → { squadId, name, inviteCode }
export async function handleSquadCreate(c) {
  const userId = c.get('userId');
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid_json' }, 400); }

  const name = (body?.name ?? '').trim();
  if (!name || name.length > MAX_NAME_LEN)
    return c.json({ error: 'invalid_name', max: MAX_NAME_LEN }, 400);

  // Enforce a per-user cap to prevent squad-spam
  const ownerCount = await c.env.DB
    .prepare('SELECT COUNT(*) AS n FROM squads WHERE owner_user_id = ?')
    .bind(userId).first();
  if ((ownerCount?.n ?? 0) >= MAX_SQUADS_PER_USER)
    return c.json({ error: 'squad_limit_reached', max: MAX_SQUADS_PER_USER }, 400);

  // Generate a unique invite code (retry on collision)
  let inviteCode = null;
  for (let attempt = 0; attempt < INVITE_CODE_GEN_ATTEMPTS; attempt++) {
    const candidate = generateInviteCode();
    const exists = await c.env.DB
      .prepare('SELECT 1 FROM squads WHERE invite_code = ?')
      .bind(candidate).first();
    if (!exists) { inviteCode = candidate; break; }
  }
  if (!inviteCode) return c.json({ error: 'invite_code_collision' }, 500);

  const squadId = crypto.randomUUID();
  const now = Date.now();

  // Create squad + add owner as first member (single transaction via D1 batch)
  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO squads (squad_id, invite_code, name, owner_user_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(squadId, inviteCode, name, userId, now),
    c.env.DB.prepare(`
      INSERT INTO squad_members (squad_id, user_id, joined_at)
      VALUES (?, ?, ?)
    `).bind(squadId, userId, now),
  ]);

  return c.json({ squadId, name, inviteCode });
}

// GET /squads/preview?code=ABC123 (PUBLIC, no auth) → { name, memberCount, owner }
// Used by the deep-link landing flow: shows squad details in a confirm
// modal before the user commits to joining. Returns just enough public
// metadata for a decision; no PII beyond the owner's chosen nickname.
//
// vc78 / C2.2: rate-limited to 30 req/min/IP via the RL_PREVIEW binding to
// kill the squad-enumeration attack. The check is wrapped in optional
// chaining so local dev (no binding) still works.
export async function handleSquadPreview(c) {
  const ip = c.req.header('CF-Connecting-IP')
          || c.req.header('X-Forwarded-For')
          || 'unknown';
  if (c.env.RL_PREVIEW?.limit) {
    const { success } = await c.env.RL_PREVIEW.limit({ key: ip });
    if (!success) return c.json({ error: 'rate_limited' }, 429);
  }

  const code = (c.req.query('code') ?? '').trim().toUpperCase();
  if (!code || !/^[A-Z0-9]{4,8}$/.test(code))
    return c.json({ error: 'invalid_code' }, 400);

  const row = await c.env.DB.prepare(`
    SELECT s.name, s.squad_id, u.nickname AS owner
    FROM squads s
    LEFT JOIN users u ON u.user_id = s.owner_user_id
    WHERE s.invite_code = ?
  `).bind(code).first();
  if (!row) return c.json({ error: 'invalid_code' }, 404);

  const count = await c.env.DB
    .prepare('SELECT COUNT(*) AS n FROM squad_members WHERE squad_id = ?')
    .bind(row.squad_id).first();

  return c.json({
    name:        row.name,
    owner:       row.owner ?? 'Unknown',
    memberCount: count?.n ?? 0,
    max:         MAX_MEMBERS_PER_SQUAD,
  });
}

// POST /squads/join  Bearer  { inviteCode } → { squadId, name }
export async function handleSquadJoin(c) {
  const userId = c.get('userId');
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid_json' }, 400); }

  const code = (body?.inviteCode ?? '').trim().toUpperCase();
  if (!code) return c.json({ error: 'missing_inviteCode' }, 400);

  const squad = await c.env.DB
    .prepare('SELECT squad_id, name FROM squads WHERE invite_code = ?')
    .bind(code).first();
  if (!squad) return c.json({ error: 'invalid_code' }, 404);

  // Already a member?
  const existing = await c.env.DB
    .prepare('SELECT 1 FROM squad_members WHERE squad_id = ? AND user_id = ?')
    .bind(squad.squad_id, userId).first();
  if (existing)
    return c.json({ squadId: squad.squad_id, name: squad.name, alreadyMember: true });

  // Capacity check
  const count = await c.env.DB
    .prepare('SELECT COUNT(*) AS n FROM squad_members WHERE squad_id = ?')
    .bind(squad.squad_id).first();
  if ((count?.n ?? 0) >= MAX_MEMBERS_PER_SQUAD)
    return c.json({ error: 'squad_full', max: MAX_MEMBERS_PER_SQUAD }, 400);

  await c.env.DB.prepare(`
    INSERT INTO squad_members (squad_id, user_id, joined_at) VALUES (?, ?, ?)
  `).bind(squad.squad_id, userId, Date.now()).run();

  return c.json({ squadId: squad.squad_id, name: squad.name });
}

// GET /squads  Bearer → { squads: [...] }
export async function handleSquadsList(c) {
  const userId = c.get('userId');
  const rows = await c.env.DB.prepare(`
    SELECT s.squad_id, s.invite_code, s.name, s.owner_user_id, s.created_at,
           (SELECT COUNT(*) FROM squad_members WHERE squad_id = s.squad_id) AS member_count
    FROM squads s
    JOIN squad_members m ON m.squad_id = s.squad_id
    WHERE m.user_id = ?
    ORDER BY m.joined_at DESC
  `).bind(userId).all();

  return c.json({
    squads: (rows.results || []).map(r => ({
      squadId:     r.squad_id,
      inviteCode:  r.invite_code,
      name:        r.name,
      isOwner:     r.owner_user_id === userId,
      memberCount: r.member_count,
      createdAt:   r.created_at,
    })),
  });
}

// GET /squads/:id/board?date=YYYY-MM-DD&lang=en&window=day|week|all
//
// Three views over the same squad:
//   - window=day  (default): single-puzzle leaderboard for `date`
//   - window=week:           sum of scores for the 7 IST days ending at `date`
//   - window=all:            lifetime sum of scores per member, all dates
//
// Day view rows carry per-puzzle fields (attempts, hardMode, won).
// Week/all rows carry aggregate fields (gamesPlayed, gamesWon).
// The `score` field is the comparable number in all three modes.
export async function handleSquadBoard(c) {
  const userId  = c.get('userId');
  const squadId = c.req.param('id');
  const date    = c.req.query('date')   || todayIstDateString();
  const lang    = c.req.query('lang')   || 'en';
  const window  = c.req.query('window') || 'day';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: 'invalid_date' }, 400);
  if (lang !== 'en' && lang !== 'hi')   return c.json({ error: 'invalid_lang' }, 400);
  if (!['day', 'week', 'all'].includes(window))
    return c.json({ error: 'invalid_window' }, 400);

  // Auth: must be a member of this squad
  const member = await c.env.DB
    .prepare('SELECT 1 FROM squad_members WHERE squad_id = ? AND user_id = ?')
    .bind(squadId, userId).first();
  if (!member) return c.json({ error: 'not_a_member' }, 403);

  // Squad metadata
  const squad = await c.env.DB
    .prepare('SELECT name, invite_code FROM squads WHERE squad_id = ?')
    .bind(squadId).first();
  if (!squad) return c.json({ error: 'squad_not_found' }, 404);

  let members, windowStart, windowEnd;

  if (window === 'day') {
    members = await dayBoard(c.env.DB, squadId, date, lang, userId);
  } else {
    ({ members, windowStart, windowEnd } = await aggregateBoard(
      c.env.DB, squadId, date, lang, userId, window
    ));
  }

  const myRank = members.findIndex(m => m.userId === userId) + 1; // 1-indexed

  return c.json({
    squadId,
    name:        squad.name,
    inviteCode:  squad.invite_code,
    date,
    lang,
    window,
    ...(windowStart ? { windowStart, windowEnd } : {}),
    members,
    myRank,
    memberCount: members.length,
  });
}

// ── Day view: one puzzle, per-row attempts/hardMode/won ────────────────────
async function dayBoard(db, squadId, date, lang, viewerId) {
  const rows = await db.prepare(`
    SELECT u.user_id, u.nickname,
           s.won, s.attempts, s.hard_mode, s.duration_ms, s.submitted_at, s.hints_used
    FROM squad_members m
    JOIN users u ON u.user_id = m.user_id
    LEFT JOIN sessions s ON s.user_id = m.user_id
                        AND s.puzzle_date = ?
                        AND s.lang = ?
    WHERE m.squad_id = ?
  `).bind(date, lang, squadId).all();

  const members = (rows.results || []).map(r => {
    const score = puzzleScore({
      won:       !!r.won,
      attempts:  r.attempts,
      hardMode:  !!r.hard_mode,
      hintsUsed: r.hints_used ?? 0,
    });
    return {
      userId:      r.user_id,
      nickname:    r.nickname,
      played:      r.attempts != null,
      won:         !!r.won,
      attempts:    r.attempts,
      hardMode:    !!r.hard_mode,
      score,
      submittedAt: r.submitted_at,
      isMe:        r.user_id === viewerId,
    };
  });
  members.sort(compareForLeaderboard);
  return members;
}

// ── Aggregate view (week / all-time) ───────────────────────────────────────
// Pulls every member's relevant sessions in one LEFT JOIN, then sums scores
// in JS using the same puzzleScore formula the day view uses. Per-row shape
// is { score, gamesPlayed, gamesWon } — no per-puzzle hardMode/attempts
// because they don't make sense over multiple games.
async function aggregateBoard(db, squadId, endDate, lang, viewerId, window) {
  let startDate = null;
  if (window === 'week') {
    // 7-day window ending at endDate (inclusive). i.e. endDate-6 .. endDate
    const end = new Date(endDate + 'T00:00:00Z').getTime();
    startDate = new Date(end - 6 * 86400000).toISOString().slice(0, 10);
  }

  const sql = window === 'week'
    ? `
        SELECT u.user_id, u.nickname,
               s.puzzle_date, s.won, s.attempts, s.hard_mode, s.hints_used
        FROM squad_members m
        JOIN users u ON u.user_id = m.user_id
        LEFT JOIN sessions s ON s.user_id = m.user_id
                            AND s.lang = ?
                            AND s.puzzle_date >= ?
                            AND s.puzzle_date <= ?
        WHERE m.squad_id = ?
      `
    : `
        SELECT u.user_id, u.nickname,
               s.puzzle_date, s.won, s.attempts, s.hard_mode, s.hints_used
        FROM squad_members m
        JOIN users u ON u.user_id = m.user_id
        LEFT JOIN sessions s ON s.user_id = m.user_id
                            AND s.lang = ?
        WHERE m.squad_id = ?
      `;
  const bindings = window === 'week'
    ? [lang, startDate, endDate, squadId]
    : [lang, squadId];

  const rows = await db.prepare(sql).bind(...bindings).all();

  // Fold rows into a per-member aggregate. The LEFT JOIN produces one row
  // per (member × session); members with zero sessions in the window still
  // appear once with all session-fields null.
  const byUser = new Map();
  for (const r of (rows.results || [])) {
    let agg = byUser.get(r.user_id);
    if (!agg) {
      agg = {
        userId:      r.user_id,
        nickname:    r.nickname,
        score:       0,
        gamesPlayed: 0,
        gamesWon:    0,
        isMe:        r.user_id === viewerId,
      };
      byUser.set(r.user_id, agg);
    }
    if (r.attempts != null) {  // an actual session row, not a null-fill from LEFT JOIN
      agg.gamesPlayed++;
      if (r.won) agg.gamesWon++;
      agg.score += puzzleScore({
        won:       !!r.won,
        attempts:  r.attempts,
        hardMode:  !!r.hard_mode,
        hintsUsed: r.hints_used ?? 0,
      });
    }
  }

  const members = [...byUser.values()];
  // Tiebreaker order for aggregates: score → gamesPlayed → gamesWon → nickname.
  // gamesPlayed matters because consistency is the point of the aggregate view.
  members.sort((a, b) => {
    if (b.score !== a.score)             return b.score - a.score;
    if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
    if (b.gamesWon !== a.gamesWon)       return b.gamesWon - a.gamesWon;
    return String(a.nickname || '').localeCompare(String(b.nickname || ''));
  });

  return {
    members,
    windowStart: startDate,
    windowEnd:   window === 'week' ? endDate : null,
  };
}

// DELETE /squads/:id  Bearer
// If user is owner → disbands squad (cascades members). Else → leaves.
export async function handleSquadLeave(c) {
  const userId  = c.get('userId');
  const squadId = c.req.param('id');

  const squad = await c.env.DB
    .prepare('SELECT owner_user_id FROM squads WHERE squad_id = ?')
    .bind(squadId).first();
  if (!squad) return c.json({ error: 'squad_not_found' }, 404);

  if (squad.owner_user_id === userId) {
    // Owner disbands the entire squad
    await c.env.DB.prepare('DELETE FROM squads WHERE squad_id = ?').bind(squadId).run();
    return c.json({ ok: true, action: 'disbanded' });
  } else {
    // Non-owner just leaves
    await c.env.DB
      .prepare('DELETE FROM squad_members WHERE squad_id = ? AND user_id = ?')
      .bind(squadId, userId).run();
    return c.json({ ok: true, action: 'left' });
  }
}

function todayIstDateString() {
  const istNow = new Date(Date.now() + 19800 * 1000);
  return istNow.toISOString().slice(0, 10);
}
