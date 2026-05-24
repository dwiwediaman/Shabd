// WordleMechanic — mirrors wordle_mechanic.gd
import { getDailyPool, isValidGuess, getGuessSet } from './wordDb.js';
import { getPuzzleIndex } from './seedEngine.js';

export const TILE_CORRECT = 'correct';
export const TILE_PRESENT = 'present';
export const TILE_ABSENT  = 'absent';

const MAX_GUESSES = 6;
const TILES = { hi: 4, en: 5 };
const TIER_WEIGHTS = { common: 70, mid: 90 }; // cumulative: 0-69=common, 70-89=mid, 90-99=challenge

// New permutation-based algorithm activates from this puzzle index forward.
// Days before this keep the legacy seed%pool lookup so historical sessions
// (saved guesses, archive plays) stay consistent.
const PERMUTATION_ALGO_FROM_DAY = 132;

// ── Sync deterministic hash (cyrb53) — returns 53-bit unsigned int ────────
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// mulberry32 PRNG — deterministic, seeded
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates shuffle with seeded RNG — pure, deterministic
function seededShuffle(arr, seed) {
  const out = arr.slice();
  const rng = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Per-day raw tier roll using sync hash
function rawTierForDay(puzzleIndex, lang) {
  const roll = cyrb53(`shabd-tier-v2|${lang}|${puzzleIndex}`) % 100;
  if (roll >= TIER_WEIGHTS.mid)    return 'challenge';
  if (roll >= TIER_WEIGHTS.common) return 'mid';
  return 'common';
}

// Effective tier: if raw tier's pool is empty, demote to 'common' so
// the K-counting always uses a tier that actually has a pool.
// This prevents collisions between (empty-tier→common-fallback) days and
// genuine common days at matching positions.
function effectiveTierForDay(puzzleIndex, lang) {
  const raw = rawTierForDay(puzzleIndex, lang);
  if (getDailyPool(lang, raw).length > 0) return raw;
  return 'common';
}

// Count: of days PERMUTATION_ALGO_FROM_DAY..puzzleIndex, how many had this
// EFFECTIVE tier? Returns zero-indexed position in that tier's sequence.
function tierPositionAt(puzzleIndex, lang, tier) {
  let k = 0;
  for (let d = PERMUTATION_ALGO_FROM_DAY; d <= puzzleIndex; d++) {
    if (effectiveTierForDay(d, lang) === tier) k++;
  }
  return k - 1;
}

// Cache of shuffled pools per (lang|tier) — pools don't change at runtime
const _shuffledCache = {};
function shuffledPoolFor(lang, tier, pool) {
  const key = `${lang}|${tier}`;
  if (!_shuffledCache[key]) {
    const shuffleSeed = cyrb53(`shabd-shuffle-v2|${lang}|${tier}`);
    _shuffledCache[key] = seededShuffle(pool, shuffleSeed);
  }
  return _shuffledCache[key];
}

// Separate shuffle for days 1..131 (legacy era). Using a different seed lets
// us retroactively dedupe within that range without touching the algo-era
// sequence (132+), so today's puzzle and every tester's mid-game session
// stay stable. Cross-era collisions between an era-1 day and an era-2 day
// are possible but rare (~1/poolSize).
function legacyShuffledPoolFor(lang, tier, pool) {
  const key = `legacy|${lang}|${tier}`;
  if (!_shuffledCache[key]) {
    const shuffleSeed = cyrb53(`shabd-legacy-shuffle-v1|${lang}|${tier}`);
    _shuffledCache[key] = seededShuffle(pool, shuffleSeed);
  }
  return _shuffledCache[key];
}

function legacyTierPositionAt(puzzleIndex, lang, tier) {
  let k = 0;
  for (let d = 1; d <= puzzleIndex; d++) {
    if (effectiveTierForDay(d, lang) === tier) k++;
  }
  return k - 1;
}

// Preserved so the one-shot migration can compute the OLD legacy target and
// only delete archive sessions whose target actually changed under the new
// permutation path. Not used by generate() anymore.
export function _legacyTarget(seed, lang) {
  const tierRoll = Math.floor(seed / 2 ** 32) % 100;
  let tier = 'common';
  if (tierRoll >= TIER_WEIGHTS.common) tier = 'mid';
  if (tierRoll >= TIER_WEIGHTS.mid)    tier = 'challenge';
  let pool = getDailyPool(lang, tier);
  if (!pool.length) pool = getDailyPool(lang, 'common');
  if (!pool.length) return null;
  const index = seed % pool.length;
  return pool[index]?.word ?? null;
}

// Reset cache (test-only)
export function _resetShuffleCacheForTests() { for (const k in _shuffledCache) delete _shuffledCache[k]; }

export function generate(seed, lang, istDate) {
  const puzzleIndex = getPuzzleIndex(istDate);

  // ── New permutation-based path (no duplicates within a tier's pool) ────
  if (puzzleIndex >= PERMUTATION_ALGO_FROM_DAY) {
    const tier     = effectiveTierForDay(puzzleIndex, lang);
    const basePool = getDailyPool(lang, tier);
    const shuffled = shuffledPoolFor(lang, tier, basePool);
    const k        = tierPositionAt(puzzleIndex, lang, tier);
    const entry    = shuffled[((k % shuffled.length) + shuffled.length) % shuffled.length];

    return {
      target:     entry.word,
      tileCount:  TILES[lang] ?? 5,
      maxGuesses: MAX_GUESSES,
      lang,
      puzzleIndex,
      meta: { tier, freqRank: entry.frequency_rank ?? -1 },
    };
  }

  // ── Legacy-era (1..131): retroactive permutation with a SEPARATE shuffle.
  // The original seed%pool approach produced ~199 collisions in 365 days
  // (e.g. 'donna' repeated). We dedupe within this range without affecting
  // algo-era days. Archive sessions whose target shifted are wiped at boot
  // by migrateLegacyArchiveSessions (see migrations.js).
  const tier     = effectiveTierForDay(puzzleIndex, lang);
  const basePool = getDailyPool(lang, tier);
  const shuffled = legacyShuffledPoolFor(lang, tier, basePool);
  const k        = legacyTierPositionAt(puzzleIndex, lang, tier);
  const entry    = shuffled[((k % shuffled.length) + shuffled.length) % shuffled.length];

  return {
    target:     entry.word,
    tileCount:  TILES[lang] ?? 5,
    maxGuesses: MAX_GUESSES,
    lang,
    puzzleIndex,
    meta: { tier, freqRank: entry.frequency_rank ?? -1 },
  };
}

export function validateGuess(input, puzzle) {
  const inputTiles  = splitTiles(input, puzzle.lang);
  const targetTiles = splitTiles(puzzle.target, puzzle.lang);

  if (inputTiles.length !== puzzle.tileCount) {
    return { isValid: false, rejectionReason: 'wrong_length', perTileState: [], isCorrect: false, input };
  }

  const normalized = normalize(input, puzzle.lang);
  if (!isValidGuess(normalized, puzzle.lang)) {
    return { isValid: false, rejectionReason: 'not_in_dictionary', perTileState: [], isCorrect: false, input };
  }

  const perTileState = computeTileStates(inputTiles, targetTiles);
  const isCorrect = perTileState.every(s => s === TILE_CORRECT);
  return { isValid: true, perTileState, isCorrect, input };
}

export function renderShareGrid(puzzle, history) {
  const attempts = history.length;
  const won = attempts > 0 && history[attempts - 1].isCorrect;
  const solvedIn = won ? `${attempts}/${puzzle.maxGuesses}` : `X/${puzzle.maxGuesses}`;
  const langLabel = puzzle.lang.toUpperCase();

  const lines = [`Shabd ${langLabel} #${puzzle.puzzleIndex} ${solvedIn}`];
  for (const guess of history) {
    lines.push(guess.perTileState.map(s =>
      s === TILE_CORRECT ? '🟩' : s === TILE_PRESENT ? '🟨' : '⬜'
    ).join(''));
  }
  lines.push('');
  lines.push('Play Shabd on Google Play:');
  lines.push('https://play.google.com/store/apps/details?id=in.shabd.game');
  return lines.join('\n');
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function splitTiles(word, lang) {
  if (lang === 'en') return [...word.toLowerCase()];
  return splitAksharas(word);
}

function splitAksharas(word) {
  // A Devanagari "akshara" is one orthographic syllable: a base consonant
  // (possibly preceded by halant-joined consonants forming a conjunct) plus
  // any attached matras / nukta / anusvara / visarga / virama / ZWJ / ZWNJ.
  //
  // Algorithm: a new akshara starts on a non-combining character only when
  // the PREVIOUS character was NOT a halant (्). If it was a halant, the
  // current consonant joins the cluster.
  //
  //   स्वाधीनता
  //   = स + ् + व + ा + ध + ी + न + त + ा
  //   → [स्व + ा, धी, न, ता]
  //   → ['स्वा', 'धी', 'न', 'ता']   ← 4 aksharas (correct)
  //
  // Before this fix the splitter produced ['स्', 'वा', 'धी', 'न', 'ता']
  // which made conjunct-cluster Hindi words unsolvable in a 4-tile grid.
  const HALANT = 0x094D;
  const out = [];
  let current = '';
  let prevWasHalant = false;
  for (const ch of word) {
    const isCombining = isCombiningMark(ch);
    if (isCombining) {
      current += ch;
    } else if (prevWasHalant) {
      current += ch;  // consonant joining a conjunct cluster
    } else {
      if (current) out.push(current);
      current = ch;
    }
    prevWasHalant = (ch.codePointAt(0) === HALANT);
  }
  if (current) out.push(current);
  return out;
}

function isCombiningMark(ch) {
  const cp = ch.codePointAt(0);
  return (cp >= 0x093A && cp <= 0x094F) ||
    cp === 0x093C || cp === 0x094D ||
    (cp >= 0x0951 && cp <= 0x0957) ||
    cp === 0x0902 || cp === 0x0903 ||
    cp === 0x0900 || cp === 0x200C || cp === 0x200D;
}

export function normalize(word, lang) {
  return lang === 'en' ? word.toLowerCase().trim() : word.trim();
}

export function computeTileStates(input, target) {
  const n = target.length;
  const states = new Array(n).fill(TILE_ABSENT);
  const remaining = {};

  // Pass 1: greens
  for (let i = 0; i < n; i++) {
    if (input[i] === target[i]) {
      states[i] = TILE_CORRECT;
    } else {
      remaining[target[i]] = (remaining[target[i]] ?? 0) + 1;
    }
  }

  // Pass 2: yellows
  for (let i = 0; i < n; i++) {
    if (states[i] === TILE_CORRECT) continue;
    const t = input[i];
    if (remaining[t] > 0) {
      states[i] = TILE_PRESENT;
      remaining[t]--;
    }
  }

  return states;
}

// ── Spell-suggest (vc99) ──────────────────────────────────────────────────
// When the user submits a word that isn't in the guess pool, find the
// closest valid same-length word so the puzzle screen can offer a "Did
// you mean BLISS?" toast instead of just "Not in word list". Cuts the
// frustration of typos in an otherwise-correct guess.
//
// Distance is computed on splitTiles arrays so Hindi works correctly
// (a matra isn't a separate edit from its consonant — they're one tile).

// Bounded Levenshtein on two arrays. Returns `max + 1` immediately if
// the true distance can't be ≤ max — saves time when iterating ~8k
// candidates and almost all are far away.
function tileDistance(a, b, max) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > max) return max + 1;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    let rowMin = dp[0];
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : Math.min(prev, dp[j], dp[j - 1]) + 1;
      prev = tmp;
      if (dp[j] < rowMin) rowMin = dp[j];
    }
    if (rowMin > max) return max + 1; // any further i row can only grow
  }
  return dp[n];
}

/**
 * Find the closest valid guess to `input` within `maxDist` tile edits.
 * Returns the candidate word string, or null if no candidate within
 * distance OR the input is already valid (caller should check that first
 * but we guard anyway).
 *
 * Same-length only: callers reach here AFTER validateGuess returned
 * isValid=false with a NON-`wrong_length` reason, so the input already
 * has the right tile count and any suggestion shorter or longer would
 * just bounce back as wrong_length.
 */
export function findClosestGuess(input, lang, { maxDist = 2 } = {}) {
  const set = getGuessSet(lang);
  if (!set || !input) return null;

  const normalized = String(input).toLowerCase();
  if (set.has(normalized)) return null;

  const inputTiles = splitTiles(normalized, lang);
  const targetLen  = inputTiles.length;
  if (!targetLen) return null;

  let best = null;
  let bestDist = maxDist + 1;

  for (const candidate of set) {
    // Cheap pre-filter: skip wildly different lengths before we splitTiles.
    if (Math.abs(candidate.length - normalized.length) > maxDist) continue;
    const candTiles = splitTiles(candidate, lang);
    if (candTiles.length !== targetLen) continue; // same tile count only
    const d = tileDistance(inputTiles, candTiles, bestDist - 1);
    if (d < bestDist) {
      best = candidate;
      bestDist = d;
      if (d === 1) break; // can't do better than 1
    }
  }
  return best;
}
