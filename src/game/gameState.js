// GameState — localStorage persistence, mirrors GameState.gd
const KEY = 'shabd_state_v1';

const DEFAULTS = {
  streak:   { hi: { current: 0, max: 0, lastDate: '' }, en: { current: 0, max: 0, lastDate: '' } },
  stats:    { hi: { played: 0, won: 0, dist: [0,0,0,0,0,0] }, en: { played: 0, won: 0, dist: [0,0,0,0,0,0] } },
  settings: { lang: 'en', kbMode: 'hinglish', sound: true, haptics: true, notifications: true, notifHour: 20, theme: 'default' },
  flags:    { seenTutorial: false },
  // today's in-progress guess history, keyed by "YYYY-MM-DD|lang"
  sessions: {},
};

let _state = null;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    _state = raw ? deepMerge(structuredClone(DEFAULTS), JSON.parse(raw)) : structuredClone(DEFAULTS);
  } catch {
    _state = structuredClone(DEFAULTS);
  }
  return _state;
}

export function get() {
  if (!_state) load();
  return _state;
}

export function save() {
  localStorage.setItem(KEY, JSON.stringify(_state));
}

export function recordCompletion(lang, won, attempts, istDate) {
  const s = get();
  s.stats[lang].played++;
  if (won) {
    s.stats[lang].won++;
    s.stats[lang].dist[attempts - 1]++;
    _advanceStreak(lang, istDate);
  } else {
    s.streak[lang].current = 0;
    s.streak[lang].lastDate = istDate;
  }
  save();
}

export function saveSession(sessionKey, guesses) {
  get().sessions[sessionKey] = guesses;
  save();
}

export function getSession(sessionKey) {
  return get().sessions[sessionKey] ?? null;
}

export function setSetting(key, value) {
  get().settings[key] = value;
  save();
}

function _advanceStreak(lang, istDate) {
  const streak = get().streak[lang];
  const isConsecutive = _isNextDay(streak.lastDate, istDate);
  streak.current = isConsecutive ? streak.current + 1 : 1;
  streak.max = Math.max(streak.max, streak.current);
  streak.lastDate = istDate;
}

function _isNextDay(prev, current) {
  if (!prev) return false;
  const a = new Date(prev + 'T00:00:00Z').getTime();
  const b = new Date(current + 'T00:00:00Z').getTime();
  return b - a === 86400000;
}

function deepMerge(target, source) {
  for (const k of Object.keys(source)) {
    if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      if (!target[k]) target[k] = {};
      deepMerge(target[k], source[k]);
    } else {
      target[k] = source[k];
    }
  }
  return target;
}
