-- Shabd backend initial schema
-- Covers: user identity, cloud-save sessions, squads (private leaderboards),
-- and the score submissions that feed the leaderboard.

-- ── Users ─────────────────────────────────────────────────────────────────
-- One row per cloud-linked account. Created the first time a user signs in
-- with Google. `google_sub` is Google's opaque per-user ID — we never store
-- email or name. `nickname` is the human-facing handle in squads.
CREATE TABLE IF NOT EXISTS users (
  user_id      TEXT PRIMARY KEY,             -- UUID v4 generated server-side
  google_sub   TEXT UNIQUE NOT NULL,         -- Google's 'sub' claim
  nickname     TEXT NOT NULL,                -- 1-24 chars, shown in squads
  created_at   INTEGER NOT NULL,             -- epoch ms
  last_sync_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);

-- ── Sessions (cloud save) ─────────────────────────────────────────────────
-- One row per (user, puzzle_date, lang). Stores the actual guesses so the
-- server can replay+verify scores for anti-cheat. Same data shape as the
-- client's localStorage sessions.
CREATE TABLE IF NOT EXISTS sessions (
  user_id      TEXT NOT NULL,
  puzzle_date  TEXT NOT NULL,                -- 'YYYY-MM-DD' IST
  lang         TEXT NOT NULL,                -- 'en' | 'hi'
  guesses_json TEXT NOT NULL,                -- JSON: [{input, perTileState, isCorrect}, ...]
  won          INTEGER NOT NULL,             -- 0 | 1
  attempts     INTEGER NOT NULL,             -- guesses.length
  hard_mode    INTEGER NOT NULL DEFAULT 0,
  duration_ms  INTEGER,                      -- nullable: time from first guess to last
  submitted_at INTEGER NOT NULL,             -- epoch ms
  PRIMARY KEY (user_id, puzzle_date, lang),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user      ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_puzzle    ON sessions(puzzle_date, lang);

-- ── Streak freezes ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS freezes (
  user_id  TEXT NOT NULL,
  lang     TEXT NOT NULL,
  iso_week TEXT NOT NULL,                    -- e.g. '2026-W19'
  used_at  INTEGER,                          -- null = available, non-null = used
  PRIMARY KEY (user_id, lang, iso_week),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ── User prefs (synced subset) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prefs (
  user_id       TEXT PRIMARY KEY,
  lang          TEXT,                        -- 'en' | 'hi' | NULL
  hard_mode     INTEGER NOT NULL DEFAULT 0,
  seen_tutorial INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ── Squads ────────────────────────────────────────────────────────────────
-- A private leaderboard group. Max 50 members enforced in app code.
CREATE TABLE IF NOT EXISTS squads (
  squad_id      TEXT PRIMARY KEY,            -- UUID v4
  invite_code   TEXT UNIQUE NOT NULL,        -- 6-char [A-Z0-9] e.g. 'SHBAX3'
  name          TEXT NOT NULL,               -- 1-32 chars
  owner_user_id TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_squads_code  ON squads(invite_code);
CREATE INDEX IF NOT EXISTS idx_squads_owner ON squads(owner_user_id);

-- ── Squad memberships ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS squad_members (
  squad_id  TEXT NOT NULL,
  user_id   TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (squad_id, user_id),
  FOREIGN KEY (squad_id) REFERENCES squads(squad_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)  REFERENCES users(user_id)   ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_members_user ON squad_members(user_id);

-- ── Auth nonces (replay protection for Google ID tokens) ──────────────────
-- Stores the Google token JTI to prevent reuse. Pruned by TTL.
CREATE TABLE IF NOT EXISTS auth_nonces (
  jti        TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
