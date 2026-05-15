// WordleMechanic — mirrors wordle_mechanic.gd
import { getDailyPool, isValidGuess } from './wordDb.js';
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

  // ── Legacy path (pre-cutoff) — keeps historical days unchanged ─────────
  const tierRoll = Math.floor(seed / 2 ** 32) % 100;
  let tier = 'common';
  if (tierRoll >= TIER_WEIGHTS.common) tier = 'mid';
  if (tierRoll >= TIER_WEIGHTS.mid)    tier = 'challenge';

  let pool = getDailyPool(lang, tier);
  if (!pool.length) pool = getDailyPool(lang, 'common');

  const index = seed % pool.length;
  const entry = pool[index];

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
  const out = [];
  let current = '';
  for (const ch of word) {
    if (isCombiningMark(ch)) {
      current += ch;
    } else {
      if (current) out.push(current);
      current = ch;
    }
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
