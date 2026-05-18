-- vc76 — add hints_used to sessions for leaderboard scoring.
--
-- Background: until now hint usage was tracked only client-side per game
-- (not persisted, never sent). Squad-leaderboard scoring (designed in
-- vc76) deducts one point per hint, so the server needs to know.
--
-- Default 0 = "no hints used" so all pre-vc76 rows score the same as
-- they would have under the old attempt-only ranking. Newly-submitted
-- sessions populate the real count.

ALTER TABLE sessions ADD COLUMN hints_used INTEGER NOT NULL DEFAULT 0;
