// WordleMechanic — mirrors wordle_mechanic.gd
import { getDailyPool, isValidGuess } from './wordDb.js';
import { getPuzzleIndex } from './seedEngine.js';

export const TILE_CORRECT = 'correct';
export const TILE_PRESENT = 'present';
export const TILE_ABSENT  = 'absent';

const MAX_GUESSES = 6;
const TILES = { hi: 4, en: 5 };
const TIER_WEIGHTS = { common: 70, mid: 90 }; // cumulative: 0-69=common, 70-89=mid, 90-99=challenge

export function generate(seed, lang, istDate) {
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
    puzzleIndex: getPuzzleIndex(istDate),
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
