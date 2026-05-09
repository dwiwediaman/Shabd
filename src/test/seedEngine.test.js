import { describe, it, expect } from 'vitest';
import { getISTDate, getPuzzleIndex, getDailySeed } from '../game/seedEngine.js';

describe('getISTDate', () => {
  it('returns YYYY-MM-DD format', () => {
    const date = getISTDate(Date.now());
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('correctly converts UTC midnight to IST (next day)', () => {
    // 2026-01-01 00:00:00 UTC = 2026-01-01 05:30:00 IST → same day
    const ts = new Date('2026-01-01T00:00:00Z').getTime();
    expect(getISTDate(ts)).toBe('2026-01-01');
  });

  it('correctly converts UTC 18:31 to IST midnight+1 (next day)', () => {
    // 2026-01-01 18:31:00 UTC = 2026-01-02 00:01:00 IST → next day
    const ts = new Date('2026-01-01T18:31:00Z').getTime();
    expect(getISTDate(ts)).toBe('2026-01-02');
  });
});

describe('getPuzzleIndex', () => {
  it('returns 1 on launch day 2026-01-01', () => {
    expect(getPuzzleIndex('2026-01-01')).toBe(1);
  });

  it('returns 2 on the day after launch', () => {
    expect(getPuzzleIndex('2026-01-02')).toBe(2);
  });

  it('increments by 1 per day', () => {
    const a = getPuzzleIndex('2026-03-01');
    const b = getPuzzleIndex('2026-03-02');
    expect(b - a).toBe(1);
  });
});

describe('getDailySeed', () => {
  it('returns a positive number', async () => {
    const seed = await getDailySeed('2026-01-01', 'en');
    expect(seed).toBeGreaterThan(0);
  });

  it('is deterministic — same inputs give same seed', async () => {
    const s1 = await getDailySeed('2026-05-09', 'hi');
    const s2 = await getDailySeed('2026-05-09', 'hi');
    expect(s1).toBe(s2);
  });

  it('differs by date', async () => {
    const s1 = await getDailySeed('2026-05-09', 'en');
    const s2 = await getDailySeed('2026-05-10', 'en');
    expect(s1).not.toBe(s2);
  });

  it('differs by language', async () => {
    const s1 = await getDailySeed('2026-05-09', 'en');
    const s2 = await getDailySeed('2026-05-09', 'hi');
    expect(s1).not.toBe(s2);
  });
});
