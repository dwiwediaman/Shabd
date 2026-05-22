import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseShabdDeepLink,
  setPendingDeepLink,
  consumePendingDeepLink,
  createDeepLinkHandler,
} from '../deepLink.js';

describe('parseShabdDeepLink', () => {
  it('parses the canonical shabd://squad/<code> form', () => {
    expect(parseShabdDeepLink('shabd://squad/AX3KQ7'))
      .toEqual({ kind: 'squad', code: 'AX3KQ7' });
  });

  it('uppercases the code so server lookups always match', () => {
    expect(parseShabdDeepLink('shabd://squad/ax3kq7'))
      .toEqual({ kind: 'squad', code: 'AX3KQ7' });
  });

  it('accepts shabd:squad/<code> (no double slash — some launchers strip)', () => {
    expect(parseShabdDeepLink('shabd:squad/AX3KQ7'))
      .toEqual({ kind: 'squad', code: 'AX3KQ7' });
  });

  it('strips trailing slashes / query strings without breaking', () => {
    expect(parseShabdDeepLink('shabd://squad/AX3KQ7/'))
      .toEqual({ kind: 'squad', code: 'AX3KQ7' });
    expect(parseShabdDeepLink('shabd://squad/AX3KQ7?ref=whatsapp'))
      .toEqual({ kind: 'squad', code: 'AX3KQ7' });
  });

  it('returns null for non-shabd schemes', () => {
    expect(parseShabdDeepLink('https://example.com/squad/AX3KQ7')).toBeNull();
    expect(parseShabdDeepLink('myapp://squad/AX3KQ7')).toBeNull();
  });

  it('returns null for shabd:// URLs with unknown paths', () => {
    expect(parseShabdDeepLink('shabd://open')).toBeNull();
    expect(parseShabdDeepLink('shabd://foo/bar')).toBeNull();
  });

  it('returns null for missing/short/invalid codes', () => {
    expect(parseShabdDeepLink('shabd://squad/')).toBeNull();
    expect(parseShabdDeepLink('shabd://squad/AB')).toBeNull();   // too short
    expect(parseShabdDeepLink('shabd://squad/!!!')).toBeNull();  // non-alphanumeric
  });

  it('safely handles non-string input', () => {
    expect(parseShabdDeepLink(null)).toBeNull();
    expect(parseShabdDeepLink(undefined)).toBeNull();
    expect(parseShabdDeepLink('')).toBeNull();
    expect(parseShabdDeepLink(42)).toBeNull();
  });
});

describe('pending deep-link queue', () => {
  beforeEach(() => consumePendingDeepLink()); // drain any leftover

  it('returns null when nothing is pending', () => {
    expect(consumePendingDeepLink()).toBeNull();
  });

  it('returns the stashed value on first consume', () => {
    setPendingDeepLink({ kind: 'squad', code: 'AX3KQ7' });
    expect(consumePendingDeepLink()).toEqual({ kind: 'squad', code: 'AX3KQ7' });
  });

  it('clears after a single consume (so navigation does not loop)', () => {
    setPendingDeepLink({ kind: 'squad', code: 'AX3KQ7' });
    consumePendingDeepLink();
    expect(consumePendingDeepLink()).toBeNull();
  });
});

// ── Regression: vc81 squad-invite cold-start race ─────────────────────────
// On Android, getLaunchUrl() AND appUrlOpen both fire for the same URL.
// Two confirm modals would stack and the user-visible top modal had dead
// buttons. The handler must collapse duplicates within a short window.
describe('createDeepLinkHandler — vc81 dedupe & routing', () => {
  let t = 0;
  let navigate, isAppReady, handler;

  beforeEach(() => {
    t = 1_000_000;
    navigate   = vi.fn();
    isAppReady = vi.fn(() => true);
    handler    = createDeepLinkHandler({
      navigate,
      isAppReady,
      now: () => t,
      windowMs: 3000,
    });
  });

  it('navigates on the first squad URL', () => {
    const r = handler('shabd://squad/AX3KQ7');
    expect(r).toEqual({ navigated: true });
    expect(navigate).toHaveBeenCalledWith('squads', { joinCode: 'AX3KQ7' });
  });

  it('swallows a duplicate URL within the dedupe window', () => {
    handler('shabd://squad/AX3KQ7');
    navigate.mockClear();
    t += 500; // 0.5s later — still inside 3s window
    const r = handler('shabd://squad/AX3KQ7');
    expect(r).toEqual({ skipped: 'duplicate' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('still navigates if the duplicate arrives AFTER the window', () => {
    handler('shabd://squad/AX3KQ7');
    navigate.mockClear();
    t += 4000; // 4s later — outside 3s window
    handler('shabd://squad/AX3KQ7');
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('does not collapse two different squad codes', () => {
    handler('shabd://squad/AX3KQ7');
    handler('shabd://squad/ZZZZ99');
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenLastCalledWith('squads', { joinCode: 'ZZZZ99' });
  });

  it('case-insensitive code: same code in different case is a duplicate', () => {
    handler('shabd://squad/AX3KQ7');
    navigate.mockClear();
    t += 100;
    const r = handler('shabd://squad/ax3kq7');
    expect(r).toEqual({ skipped: 'duplicate' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('stashes (does not navigate) when the app is not yet visible', () => {
    isAppReady.mockReturnValue(false);
    const r = handler('shabd://squad/AX3KQ7');
    expect(r).toEqual({ stashed: true });
    expect(navigate).not.toHaveBeenCalled();
    expect(consumePendingDeepLink()).toEqual({ kind: 'squad', code: 'AX3KQ7' });
  });

  it('ignores garbage URLs without touching navigate', () => {
    expect(handler('about:blank')).toBeUndefined();
    expect(handler('')).toBeUndefined();
    expect(handler(null)).toBeUndefined();
    expect(navigate).not.toHaveBeenCalled();
  });
});
