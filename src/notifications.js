// Local daily reminders.
//
// Schedule the NEXT 7 days × 3 slots = up to 21 one-shot notifications at
// boot and on game completion. Days whose puzzle is already won/lost are
// skipped entirely; if today's puzzle is in-progress (any guesses but not
// finished), today's not-yet-fired slots still fire. The 7-day window
// covers a tester who doesn't reopen the app — they still get nudged.
//
// Capacitor's LocalNotifications can repeat (`every: 'day'`) but cancel
// removes a recurring entry permanently — there's no way to "skip just
// today". So we use explicit per-day scheduling and refresh on each boot.

import { LocalNotifications } from '@capacitor/local-notifications';
import { getSession } from './game/gameState.js';
import { getISTDate } from './game/seedEngine.js';

const CHANNEL_ID = 'shabd-daily';
const DAYS_AHEAD = 7;
const ID_BASE    = 100;            // reserved range 100..120
const IST_OFFSET_MS = 19800 * 1000; // +5:30

// Three reminder slots per IST day. Times are fixed (no longer user-tunable);
// the body text rotates so the user doesn't see the same line three times.
export const SLOTS = [
  { hour:  9, body: "Morning! Today's Shabd is up — give it a quick try." },
  { hour: 14, body: "Got a minute? Solve today's Shabd between meetings." },
  { hour: 20, body: "Don't break your streak — today's Shabd is waiting 🌙" },
];

function notifId(dayOffset, slotIdx) {
  return ID_BASE + dayOffset * 10 + slotIdx;
}

// IST-anchored UTC instant for `hourIST:00` on `istDateStr` (YYYY-MM-DD).
// Avoids local-TZ pitfalls of Date.setHours when the device isn't in IST.
export function istHourToUtcMs(istDateStr, hourIST) {
  const utcMidnightOfISTDate = new Date(istDateStr + 'T00:00:00Z').getTime();
  const istDayStartUtcMs     = utcMidnightOfISTDate - IST_OFFSET_MS;
  return istDayStartUtcMs + hourIST * 3_600_000;
}

// Add `days` to an IST date string, returning a new YYYY-MM-DD string.
function addDaysIST(istDateStr, days) {
  const ts = new Date(istDateStr + 'T00:00:00Z').getTime() + days * 86_400_000;
  return new Date(ts).toISOString().slice(0, 10);
}

// A session counts as "played" for the purpose of skipping reminders only
// when the puzzle is FINISHED (won or used all 6 guesses). An in-progress
// session still gets remaining nudges so the user is reminded to finish.
export function isFinished(session) {
  if (!session || !session.length) return false;
  const last = session[session.length - 1];
  return !!last?.isCorrect || session.length >= 6;
}

export async function setupNotifications() {
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Daily Puzzle',
      description: 'Daily Shabd puzzle reminder',
      importance: 3, // DEFAULT
      visibility: 1, // PUBLIC
      sound: 'default',
      vibration: true,
    });

    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted';
  } catch (_) {
    return false;
  }
}

/**
 * Cancel any reminders in our reserved ID range, then re-schedule the next
 * `DAYS_AHEAD` days × 3 slots, skipping days whose puzzle is already
 * finished in local state.
 *
 * Safe to call on every boot and after every game completion. No-op outside
 * Capacitor (silently catches LocalNotifications errors).
 *
 * @param {{ lang: 'en' | 'hi', now?: number }} opts
 * @returns {Promise<{ scheduled: number, error?: boolean }>}
 */
export async function refreshDailyReminders({ lang, now = Date.now() } = {}) {
  try {
    // 1. Cancel ALL ids in our range — covers stale schedules from earlier
    //    builds with different timings.
    const allIds = [];
    for (let d = 0; d < DAYS_AHEAD; d++) {
      for (let s = 0; s < SLOTS.length; s++) {
        allIds.push({ id: notifId(d, s) });
      }
    }
    await LocalNotifications.cancel({ notifications: allIds });

    // 2. Build the per-day schedule. Skip a day entirely if finished.
    const todayIST = getISTDate(now);
    const toSchedule = [];
    for (let d = 0; d < DAYS_AHEAD; d++) {
      const istDate = addDaysIST(todayIST, d);
      const session = getSession(`${istDate}|${lang}`);
      if (isFinished(session)) continue;

      for (let s = 0; s < SLOTS.length; s++) {
        const slot = SLOTS[s];
        const atMs = istHourToUtcMs(istDate, slot.hour);
        if (atMs <= now) continue; // slot already passed today
        toSchedule.push({
          id: notifId(d, s),
          channelId: CHANNEL_ID,
          title: '🟩 शब्द · Shabd',
          body: slot.body,
          schedule: { at: new Date(atMs) },
          actionTypeId: '',
          extra: null,
        });
      }
    }

    if (toSchedule.length) {
      await LocalNotifications.schedule({ notifications: toSchedule });
    }
    return { scheduled: toSchedule.length };
  } catch (_) {
    return { scheduled: 0, error: true };
  }
}

// Cancel ALL of our reserved IDs (used when the user turns notifications
// off in Settings, or on sign-out flows that imply "go quiet").
export async function cancelReminder() {
  try {
    const ids = [];
    for (let d = 0; d < DAYS_AHEAD; d++) {
      for (let s = 0; s < SLOTS.length; s++) ids.push({ id: notifId(d, s) });
    }
    await LocalNotifications.cancel({ notifications: ids });
  } catch (_) {}
}

// ── Back-compat shim ─────────────────────────────────────────────────────
// Older boot / settings code calls scheduleDailyReminder(hourIST) expecting
// a single fixed-hour daily notification. Bridge to refreshDailyReminders
// so legacy call sites keep working during the migration. The hourIST arg
// is ignored — slots are fixed now.
export async function scheduleDailyReminder(_hourIST) {
  const { get } = await import('./game/gameState.js');
  const lang = get()?.settings?.lang ?? 'en';
  return refreshDailyReminders({ lang });
}
