// One-shot data migrations applied at boot, after wordDb is loaded.
//
// Each migration writes its own localStorage key on success so re-runs are
// idempotent. If a migration throws, the key is NOT set — we'll retry on
// the next boot rather than silently skipping it.

import { get, save } from './game/gameState.js';
import { getDailySeed } from './game/seedEngine.js';
import { generate, _legacyTarget } from './game/wordleMechanic.js';

const LAUNCH_EPOCH_MS = new Date('2026-01-01T00:00:00Z').getTime();
const ALGO_CUTOFF_DAY = 132;
const MIGRATION_KEY   = 'shabd_migration_perm_algo_v1';

function dayFromDate(dateStr) {
  const ts = new Date(dateStr + 'T00:00:00Z').getTime();
  return Math.floor((ts - LAUNCH_EPOCH_MS) / 86400000) + 1;
}

// vc88 introduced a permutation-based target picker for days 1..131
// (replacing seed % pool.length, which produced repeats). Archive sessions
// saved under the OLD picker now point at a different word than the puzzle
// will generate on next open. Delete only the sessions whose target
// actually shifted; days where old==new (by chance) keep their record.
export async function migrateLegacyArchiveSessions() {
  try {
    if (localStorage.getItem(MIGRATION_KEY) === '1') return { skipped: 'done' };
    const state = get();
    const sessions = state.sessions || {};
    const meta     = state.sessionMeta || {};

    let removed = 0;
    for (const key of Object.keys(sessions)) {
      const [date, lang] = key.split('|');
      if (!date || !lang) continue;
      const day = dayFromDate(date);
      if (!Number.isFinite(day) || day < 1 || day >= ALGO_CUTOFF_DAY) continue;

      const seed       = await getDailySeed(date, lang);
      const oldTarget  = _legacyTarget(seed, lang);
      const newPuzzle  = generate(seed, lang, date);
      const newTarget  = newPuzzle?.target;

      if (oldTarget && newTarget && oldTarget !== newTarget) {
        delete sessions[key];
        if (meta[key]) delete meta[key];
        removed++;
      }
    }
    if (removed > 0) save();
    try { localStorage.setItem(MIGRATION_KEY, '1'); } catch {}
    if (removed > 0) console.log(`[migration] cleared ${removed} stale legacy archive sessions`);
    return { removed };
  } catch (e) {
    console.warn('[migration] migrateLegacyArchiveSessions failed (will retry next boot):', e);
    return { error: e?.message || 'unknown' };
  }
}
