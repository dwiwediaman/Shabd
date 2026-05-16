// Server-side wordle replay — mirrors the client's wordleMechanic.js EXACTLY
// for puzzles after the permutation cutoff (day 132+). The client never sends
// scores; it sends raw guesses and the server computes won/attempts/tile-states
// so cheating requires actually breaking the wordle game, not just lying.
//
// IMPORTANT: This file must stay in sync with src/game/wordleMechanic.js and
// src/game/seedEngine.js on the client side. The constants here are the
// SOURCE OF TRUTH for the server. If the algorithm ever changes, change both.

import { POOL as POOL_EN } from './data/pool_en.js';
import { POOL as POOL_HI } from './data/pool_hi.js';

const POOLS = { en: POOL_EN, hi: POOL_HI };

const TIER_WEIGHTS = { common: 70, mid: 90 };
const PERMUTATION_ALGO_FROM_DAY = 132;
const LAUNCH_EPOCH_MS = Date.UTC(2026, 0, 1);
const TILES = { hi: 4, en: 5 };
const MAX_GUESSES = 6;
const SEED_VERSION = 'shabd-v1';

// ── Date helpers ────────────────────────────────────────────────────────────
export function puzzleIndexForDate(istDate /* 'YYYY-MM-DD' */) {
  const d = Date.UTC(
    +istDate.slice(0, 4),
    +istDate.slice(5, 7) - 1,
    +istDate.slice(8, 10),
  );
  return Math.floor((d - LAUNCH_EPOCH_MS) / 86400000) + 1;
}

// ── Legacy seed (pre-cutoff days) ──────────────────────────────────────────
async function legacySeed(istDate, lang) {
  const raw = `${istDate}|${SEED_VERSION}|${lang}`;
  const buf = new TextEncoder().encode(raw);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(hashBuf);
  let seed = 0n;
  for (let i = 0; i < 8; i++) seed |= BigInt(bytes[i]) << BigInt(i * 8);
  return Number(seed & 0x7FFFFFFFFFFFFFFFn);
}

// ── Permutation algorithm helpers (post-cutoff days) ───────────────────────
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

function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, seed) {
  const out = arr.slice();
  const rng = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function rawTierForDay(puzzleIndex, lang) {
  const roll = cyrb53(`shabd-tier-v2|${lang}|${puzzleIndex}`) % 100;
  if (roll >= TIER_WEIGHTS.mid)    return 'challenge';
  if (roll >= TIER_WEIGHTS.common) return 'mid';
  return 'common';
}

function effectiveTierForDay(puzzleIndex, lang) {
  const raw = rawTierForDay(puzzleIndex, lang);
  return POOLS[lang][raw]?.length > 0 ? raw : 'common';
}

function tierPositionAt(puzzleIndex, lang, tier) {
  let k = 0;
  for (let d = PERMUTATION_ALGO_FROM_DAY; d <= puzzleIndex; d++) {
    if (effectiveTierForDay(d, lang) === tier) k++;
  }
  return k - 1;
}

const _shuffledCache = new Map();
function shuffledPoolFor(lang, tier) {
  const key = `${lang}|${tier}`;
  if (!_shuffledCache.has(key)) {
    const seed = cyrb53(`shabd-shuffle-v2|${lang}|${tier}`);
    _shuffledCache.set(key, seededShuffle(POOLS[lang][tier], seed));
  }
  return _shuffledCache.get(key);
}

// ── Public: get target word for a given (date, lang) ───────────────────────
export async function targetForPuzzle(istDate, lang) {
  if (!POOLS[lang]) throw new Error('unknown_lang');
  const puzzleIndex = puzzleIndexForDate(istDate);
  if (puzzleIndex < 1) throw new Error('before_launch');

  if (puzzleIndex >= PERMUTATION_ALGO_FROM_DAY) {
    const tier     = effectiveTierForDay(puzzleIndex, lang);
    const shuffled = shuffledPoolFor(lang, tier);
    const k        = tierPositionAt(puzzleIndex, lang, tier);
    return shuffled[((k % shuffled.length) + shuffled.length) % shuffled.length];
  }

  // Legacy path
  const seed = await legacySeed(istDate, lang);
  const tierRoll = Math.floor(seed / 2 ** 32) % 100;
  let tier = 'common';
  if (tierRoll >= TIER_WEIGHTS.common) tier = 'mid';
  if (tierRoll >= TIER_WEIGHTS.mid)    tier = 'challenge';
  let pool = POOLS[lang][tier];
  if (!pool.length) pool = POOLS[lang].common;
  const index = seed % pool.length;
  return pool[index];
}

// ── Tile splitting (lang-aware; mirrors client splitTiles) ─────────────────
function splitTiles(word, lang) {
  if (lang === 'en') return [...word.toLowerCase()];
  return splitAksharas(word);
}

function isDevanagariCombining(ch) {
  const cp = ch.codePointAt(0);
  return (cp >= 0x093A && cp <= 0x094F) || cp === 0x094D ||
         (cp >= 0x0951 && cp <= 0x0957) || cp === 0x0902 || cp === 0x0903 ||
         cp === 0x0900 || cp === 0x200C || cp === 0x200D;
}

function splitAksharas(word) {
  // Must match src/game/wordleMechanic.js exactly. See the comment there.
  // Halant-joined consonants form a conjunct akshara (e.g. स् + व → स्व).
  const HALANT = 0x094D;
  const out = [];
  let current = '';
  let prevWasHalant = false;
  for (const ch of word) {
    if (isDevanagariCombining(ch)) {
      current += ch;
    } else if (prevWasHalant) {
      current += ch;
    } else {
      if (current) out.push(current);
      current = ch;
    }
    prevWasHalant = (ch.codePointAt(0) === HALANT);
  }
  if (current) out.push(current);
  return out;
}

// ── Tile state computation (mirrors client's computeTileStates) ────────────
function computeTileStates(guessTiles, targetTiles) {
  const n = targetTiles.length;
  const states = new Array(n).fill('absent');
  const targetCounts = {};

  // First pass: mark correct + count remaining target letters
  for (let i = 0; i < n; i++) {
    if (guessTiles[i] === targetTiles[i]) {
      states[i] = 'correct';
    } else {
      targetCounts[targetTiles[i]] = (targetCounts[targetTiles[i]] ?? 0) + 1;
    }
  }
  // Second pass: mark present where possible
  for (let i = 0; i < n; i++) {
    if (states[i] === 'correct') continue;
    const g = guessTiles[i];
    if (targetCounts[g] > 0) {
      states[i] = 'present';
      targetCounts[g]--;
    }
  }
  return states;
}

// ── Public: replay a sequence of guesses → { won, attempts, perGuessStates } ─
export async function replayGuesses(istDate, lang, guesses) {
  if (!Array.isArray(guesses) || guesses.length === 0)
    throw new Error('no_guesses');
  if (guesses.length > MAX_GUESSES)
    throw new Error('too_many_guesses');

  const target      = await targetForPuzzle(istDate, lang);
  const targetTiles = splitTiles(target, lang);
  const tileCount   = TILES[lang];

  const perGuessStates = [];
  let won = false;

  for (const guess of guesses) {
    if (typeof guess !== 'string' || guess.length === 0)
      throw new Error('invalid_guess_shape');
    const tiles = splitTiles(guess, lang);
    if (tiles.length !== tileCount)
      throw new Error('wrong_tile_count');
    const states = computeTileStates(tiles, targetTiles);
    perGuessStates.push(states);
    if (states.every(s => s === 'correct')) { won = true; break; }
  }

  return {
    won,
    attempts: perGuessStates.length,
    target,
    perGuessStates,
  };
}
