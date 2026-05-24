// WordDB — loads words_hi.json + words_en.json, mirrors WordDB.gd
const _dailyPools = {};  // { lang: { common: [], mid: [], challenge: [] } }
const _guessSets = {};   // { lang: Set<string> }
let _loaded = false;

export async function loadWordDB() {
  if (_loaded) return;
  await Promise.all([_load('hi', '/data/words_hi.json'), _load('en', '/data/words_en.json')]);
  _loaded = true;
}

async function _load(lang, path) {
  const res = await fetch(path);
  const entries = await res.json();

  const tiered = { common: [], mid: [], challenge: [] };
  const guessSet = new Set();

  for (const e of entries) {
    if (e.in_guess_pool === 1) guessSet.add(e.word);
    if (e.in_daily_pool === 1) {
      const tier = e.tier || 'common';
      if (tiered[tier]) tiered[tier].push(e);
    }
  }

  _dailyPools[lang] = tiered;
  _guessSets[lang] = guessSet;
}

export function getDailyPool(lang, tier) {
  return _dailyPools[lang]?.[tier] ?? [];
}

export function isValidGuess(word, lang) {
  return _guessSets[lang]?.has(word) ?? false;
}

// Internal accessor for the spell-suggest path. Returns the full guess
// Set so findClosestGuess (in wordleMechanic.js) can iterate without
// circularity. Returns null if the lang isn't loaded yet.
export function getGuessSet(lang) {
  return _guessSets[lang] ?? null;
}

export function isLoaded() { return _loaded; }
