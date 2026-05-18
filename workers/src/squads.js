// Squads — private leaderboards with invite codes.
//
// A squad has an owner, a name, an invite code (6-char A-Z0-9), and members.
// Max 50 members per squad (enforced here). Leaderboards are computed
// per-day per-lang by joining squad_members against sessions.

const MAX_MEMBERS_PER_SQUAD     = 50;
const MAX_SQUADS_PER_USER       = 10;
const MAX_NAME_LEN              = 32;
const INVITE_CODE_ALPHABET      = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const INVITE_CODE_LEN           = 6;
const INVITE_CODE_GEN_ATTEMPTS  = 10;

function generateInviteCode() {
  let out = '';
  for (let i = 0; i < INVITE_CODE_LEN; i++) {
    out += INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)];
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
export async function handleSquadPreview(c) {
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

// GET /squads/:id/board?date=YYYY-MM-DD&lang=en → { members: [...], myRank }
//
// The leaderboard for a given (squad, date, lang). Players who haven't
// played show as `played: false`. Players who lost show won=false with
// attempts=6. Sorted: winners first (fewer attempts is better), then losses,
// then unplayed.
export async function handleSquadBoard(c) {
  const userId  = c.get('userId');
  const squadId = c.req.param('id');
  const date    = c.req.query('date') || todayIstDateString();
  const lang    = c.req.query('lang') || 'en';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: 'invalid_date' }, 400);
  if (lang !== 'en' && lang !== 'hi')   return c.json({ error: 'invalid_lang' }, 400);

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

  // Join members ⊕ their session for this puzzle (LEFT JOIN to include non-players)
  const rows = await c.env.DB.prepare(`
    SELECT u.user_id, u.nickname,
           s.won, s.attempts, s.hard_mode, s.duration_ms, s.submitted_at
    FROM squad_members m
    JOIN users u ON u.user_id = m.user_id
    LEFT JOIN sessions s ON s.user_id = m.user_id
                        AND s.puzzle_date = ?
                        AND s.lang = ?
    WHERE m.squad_id = ?
  `).bind(date, lang, squadId).all();

  const members = (rows.results || []).map(r => ({
    userId:      r.user_id,
    nickname:    r.nickname,
    played:      r.attempts != null,
    won:         !!r.won,
    attempts:    r.attempts,
    hardMode:    !!r.hard_mode,
    durationMs:  r.duration_ms,
    submittedAt: r.submitted_at,
    isMe:        r.user_id === userId,
  }));

  // Sort: won (fewer attempts better, faster better) > lost > unplayed
  members.sort((a, b) => {
    const aRank = a.won ? 0 : a.played ? 1 : 2;
    const bRank = b.won ? 0 : b.played ? 1 : 2;
    if (aRank !== bRank) return aRank - bRank;
    if (a.won && b.won) {
      if (a.attempts !== b.attempts) return a.attempts - b.attempts;
      return (a.durationMs ?? Infinity) - (b.durationMs ?? Infinity);
    }
    if (a.played && b.played) return (a.submittedAt ?? 0) - (b.submittedAt ?? 0);
    return 0;
  });

  const myRank = members.findIndex(m => m.userId === userId) + 1; // 1-indexed

  return c.json({
    squadId,
    name:     squad.name,
    inviteCode: squad.invite_code,
    date,
    lang,
    members,
    myRank,
    memberCount: members.length,
  });
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
