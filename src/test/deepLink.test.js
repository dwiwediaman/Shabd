import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseShabdDeepLink,
  setPendingDeepLink,
  consumePendingDeepLink,
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
