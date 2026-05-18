// GameState — localStorage persistence, mirrors GameState.gd
const KEY = 'shabd_state_v1';

const DEFAULTS = {
  streak:   { hi: { current: 0, max: 0, lastDate: '' }, en: { current: 0, max: 0, lastDate: '' } },
  stats:    { hi: { played: 0, won: 0, dist: [0,0,0,0,0,0] }, en: { played: 0, won: 0, dist: [0,0,0,0,0,0] } },
  settings: { lang: 'en', kbMode: 'hinglish', sound: true, haptics: true, notifications: true, notifHour: 20, theme: 'default', hardMode: false },
  flags:    { seenTutorial: false },
  freezes:  { hi: { count: 1, lastResetWeek: '' }, en: { count: 1, lastResetWeek: '' } },
  // today's in-progress guess history, keyed by "YYYY-MM-DD|lang"
  sessions: {},
  // per-session metadata that doesn't fit in the guesses array (hint count,
  // play duration). Same key shape as `sessions`. Added vc76 for leaderboard
  // scoring — missing entries imply { hintsUsed: 0, durationMs: null }, which
  // is the correct semantic for pre-vc76 historical sessions.
  sessionMeta: {},
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
  let freezeUsed = false;
  if (won) {
    s.stats[lang].won++;
    s.stats[lang].dist[attempts - 1]++;
    freezeUsed = _advanceStreak(lang, istDate);
  } else {
    s.streak[lang].current = 0;
    s.streak[lang].lastDate = istDate;
  }
  save();
  return { freezeUsed };
}

export function saveSession(sessionKey, guesses) {
  get().sessions[sessionKey] = guesses;
  save();
}

export function getSession(sessionKey) {
  return get().sessions[sessionKey] ?? null;
}

// Per-session metadata (hints used so far, total duration when finished).
// Reads return safe defaults so callers don't have to null-check every time.
export function getSessionMeta(sessionKey) {
  const s = get();
  if (!s.sessionMeta) s.sessionMeta = {};
  return s.sessionMeta[sessionKey] ?? { hintsUsed: 0, durationMs: null };
}

export function setSessionMeta(sessionKey, patch) {
  const s = get();
  if (!s.sessionMeta) s.sessionMeta = {};
  s.sessionMeta[sessionKey] = { ...getSessionMeta(sessionKey), ...patch };
  save();
}

export function setSetting(key, value) {
  get().settings[key] = value;
  save();
}

export function setFlag(key, value) {
  get().flags[key] = value;
  save();
}

export function refreshFreezes(lang, istDate) {
  const freeze = get().freezes[lang];
  _refreshFreeze(freeze, istDate);
  save();
}

function _advanceStreak(lang, istDate) {
  const s = get();
  const streak = s.streak[lang];

  if (streak.lastDate === istDate) return false;

  const isNext = _isNextDay(streak.lastDate, istDate);
  let freezeUsed = false;

  if (isNext) {
    streak.current++;
  } else {
    const skippedOne = _isExactlyOneDaySkipped(streak.lastDate, istDate);
    const freeze = s.freezes[lang];
    _refreshFreeze(freeze, istDate);

    if (skippedOne && freeze.count > 0 && streak.current > 0) {
      freeze.count--;
      streak.current++;
      freezeUsed = true;
    } else {
      streak.current = 1;
    }
  }

  streak.max = Math.max(streak.max, streak.current);
  streak.lastDate = istDate;
  return freezeUsed;
}

function _isNextDay(prev, current) {
  if (!prev) return false;
  const a = new Date(prev + 'T00:00:00Z').getTime();
  const b = new Date(current + 'T00:00:00Z').getTime();
  return b - a === 86400000;
}

function _isExactlyOneDaySkipped(prev, current) {
  if (!prev) return false;
  const a = new Date(prev + 'T00:00:00Z').getTime();
  const b = new Date(current + 'T00:00:00Z').getTime();
  return b - a === 172800000;
}

function _refreshFreeze(freeze, istDate) {
  const week = _getISOWeek(istDate);
  if (freeze.lastResetWeek !== week) {
    freeze.count = 1;
    freeze.lastResetWeek = week;
  }
}

function _getISOWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getUTCDay() + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
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
