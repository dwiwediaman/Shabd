import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage so gameState.load() can boot cleanly.
const store = {};
global.localStorage = {
  getItem:    (k) => store[k] ?? null,
  setItem:    (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear:      () => { Object.keys(store).forEach(k => delete store[k]); },
};

// Capture LocalNotifications calls so we can assert what we scheduled.
const cancelCalls   = [];
const scheduleCalls = [];
const channelCalls  = [];
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    createChannel:      vi.fn((arg) => { channelCalls.push(arg); return Promise.resolve(); }),
    requestPermissions: vi.fn(() => Promise.resolve({ display: 'granted' })),
    cancel:             vi.fn((arg) => { cancelCalls.push(arg); return Promise.resolve(); }),
    schedule:           vi.fn((arg) => { scheduleCalls.push(arg); return Promise.resolve(); }),
  },
}));

const { load, saveSession } = await import('../game/gameState.js');
const {
  refreshDailyReminders,
  istHourToUtcMs,
  isFinished,
  SLOTS,
} = await import('../notifications.js');

// 2026-05-23 12:00 IST = 06:30 UTC — picked so all three of today's slots
// are still in the future (9, 14, 20 are all > 12 except morning, which is
// before noon — so morning is skipped, afternoon + night for today fire).
// Actually picking earlier so all three of today fire too: 06:00 IST.
// 06:00 IST 2026-05-23 = 00:30 UTC same day.
const NOW = new Date('2026-05-23T00:30:00Z').getTime();

beforeEach(() => {
  localStorage.clear();
  cancelCalls.length   = 0;
  scheduleCalls.length = 0;
  load();
});

// ── Time math ─────────────────────────────────────────────────────────────
describe('istHourToUtcMs', () => {
  it('9am IST on 2026-05-23 maps to 03:30 UTC same day', () => {
    expect(istHourToUtcMs('2026-05-23', 9))
      .toBe(new Date('2026-05-23T03:30:00Z').getTime());
  });

  it('20:00 IST on 2026-05-23 maps to 14:30 UTC same day', () => {
    expect(istHourToUtcMs('2026-05-23', 20))
      .toBe(new Date('2026-05-23T14:30:00Z').getTime());
  });

  it('00:00 IST on 2026-05-23 maps to 18:30 UTC previous day', () => {
    expect(istHourToUtcMs('2026-05-23', 0))
      .toBe(new Date('2026-05-22T18:30:00Z').getTime());
  });
});

// ── Session finishedness ──────────────────────────────────────────────────
describe('isFinished', () => {
  it('null/empty sessions are not finished', () => {
    expect(isFinished(null)).toBe(false);
    expect(isFinished(undefined)).toBe(false);
    expect(isFinished([])).toBe(false);
  });

  it('one correct guess counts as finished (won)', () => {
    expect(isFinished([{ isCorrect: true }])).toBe(true);
  });

  it('six guesses with no correct counts as finished (lost)', () => {
    expect(isFinished(Array.from({ length: 6 }, () => ({ isCorrect: false }))))
      .toBe(true);
  });

  it('three guesses with no correct is in-progress, NOT finished', () => {
    expect(isFinished(Array.from({ length: 3 }, () => ({ isCorrect: false }))))
      .toBe(false);
  });
});

// ── refreshDailyReminders behaviour ───────────────────────────────────────
describe('refreshDailyReminders — vc95', () => {
  it('cancels its reserved ID range before scheduling', async () => {
    await refreshDailyReminders({ lang: 'en', now: NOW });
    // First call to cancel is the full sweep — 7 days × 3 slots = 21 ids.
    expect(cancelCalls.length).toBeGreaterThanOrEqual(1);
    expect(cancelCalls[0].notifications).toHaveLength(7 * SLOTS.length);
  });

  it('schedules 7 days × 3 slots = 21 reminders when no sessions exist', async () => {
    await refreshDailyReminders({ lang: 'en', now: NOW });
    const scheduled = scheduleCalls[0]?.notifications ?? [];
    expect(scheduled.length).toBe(7 * SLOTS.length);
  });

  it("skips a day whose puzzle has been won", async () => {
    // Mark TODAY (2026-05-23) as won in EN
    saveSession('2026-05-23|en', [{ input: 'crane', isCorrect: true, perTileState: [] }]);
    await refreshDailyReminders({ lang: 'en', now: NOW });

    const scheduled = scheduleCalls[0]?.notifications ?? [];
    // Today should contribute 0 — only days 1..6 ahead = 6 × 3 = 18 reminders.
    expect(scheduled.length).toBe(6 * SLOTS.length);
    // No scheduled at should fall on the 2026-05-23 IST day window.
    const istDayStart = istHourToUtcMs('2026-05-23', 0);
    const istDayEnd   = istHourToUtcMs('2026-05-24', 0);
    for (const n of scheduled) {
      const ts = n.schedule.at.getTime();
      expect(ts >= istDayStart && ts < istDayEnd, `notif at ${n.schedule.at} fell on the won day`).toBe(false);
    }
  });

  it('still nudges an in-progress (not-yet-finished) day', async () => {
    saveSession('2026-05-23|en', [{ input: 'crane', isCorrect: false, perTileState: [] }]);
    await refreshDailyReminders({ lang: 'en', now: NOW });
    const scheduled = scheduleCalls[0]?.notifications ?? [];
    expect(scheduled.length).toBe(7 * SLOTS.length);
  });

  it('skips slots that have already passed today', async () => {
    // Now = 15:00 IST on 2026-05-23 = 09:30 UTC. Morning (9 IST) and
    // afternoon (14 IST) are past; only night (20 IST) should fire today.
    const latishNow = new Date('2026-05-23T09:30:00Z').getTime();
    await refreshDailyReminders({ lang: 'en', now: latishNow });
    const scheduled = scheduleCalls[0]?.notifications ?? [];
    // 6 future days × 3 + today's 1 = 19.
    expect(scheduled.length).toBe(6 * SLOTS.length + 1);
  });

  it('skips finished days but keeps unfinished ones in the same call', async () => {
    // Today won, tomorrow in-progress, day-after fresh
    saveSession('2026-05-23|en', [{ input: 'crane', isCorrect: true, perTileState: [] }]);
    saveSession('2026-05-24|en', [{ input: 'bliss', isCorrect: false, perTileState: [] }]);
    await refreshDailyReminders({ lang: 'en', now: NOW });
    const scheduled = scheduleCalls[0]?.notifications ?? [];
    // 0 (today) + 3 (tomorrow in-progress) + 3×5 (rest) = 18
    expect(scheduled.length).toBe(6 * SLOTS.length);
  });

  it('language scoping: HI sessions do not affect EN reminders', async () => {
    // Today's HI puzzle solved, but EN is fresh
    saveSession('2026-05-23|hi', [{ input: 'क्रेन', isCorrect: true, perTileState: [] }]);
    await refreshDailyReminders({ lang: 'en', now: NOW });
    const scheduled = scheduleCalls[0]?.notifications ?? [];
    expect(scheduled.length).toBe(7 * SLOTS.length);
  });

  it('returns { scheduled: N } so callers can sanity-check', async () => {
    const r = await refreshDailyReminders({ lang: 'en', now: NOW });
    expect(r.scheduled).toBe(7 * SLOTS.length);
  });
});
