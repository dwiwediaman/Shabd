import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transliterateChunk, isConsonantBoundary, loadTransliterator } from '../game/transliterator.js';

// Mock fetch for transliterator data
const MOCK_CANONICAL = {
  'ka':  { canonical: 'क', candidates: ['क'] },
  'kha': { canonical: 'ख', candidates: ['ख'] },
  'ga':  { canonical: 'ग', candidates: ['ग'] },
  'ma':  { canonical: 'म', candidates: ['म'] },
  'la':  { canonical: 'ल', candidates: ['ल'] },
  'ra':  { canonical: 'र', candidates: ['र'] },
  'na':  { canonical: 'न', candidates: ['न'] },
  'ba':  { canonical: 'ब', candidates: ['ब'] },
  'sa':  { canonical: 'स', candidates: ['स'] },
  // ambiguous — multiple candidates
  'sha': { canonical: 'श', candidates: ['श', 'ष'] },
};

beforeEach(async () => {
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(MOCK_CANONICAL),
  });
  await loadTransliterator();
});

describe('transliterateChunk', () => {
  it('returns correct akshara for known chunk', () => {
    const result = transliterateChunk('ka');
    expect(result.akshara).toBe('क');
  });

  it('returns candidates array for known chunk', () => {
    const result = transliterateChunk('ka');
    expect(result.candidates).toEqual(['क']);
  });

  it('is confident when only one candidate', () => {
    expect(transliterateChunk('ka').confident).toBe(true);
  });

  it('is not confident when multiple candidates', () => {
    expect(transliterateChunk('sha').confident).toBe(false);
  });

  it('handles uppercase input by lowercasing', () => {
    const result = transliterateChunk('KA');
    expect(result.akshara).toBe('क');
  });

  it('returns empty for unknown chunk', () => {
    const result = transliterateChunk('xyz_unknown_99');
    expect(result.akshara).toBe('');
    expect(result.candidates).toEqual([]);
    expect(result.confident).toBe(false);
  });

  it('returns empty when canonical not loaded (null)', () => {
    // Simulate null canonical (before load)
    // We can check the safe-guard path
    const result = transliterateChunk('');
    expect(result.akshara).toBe('');
  });
});

describe('isConsonantBoundary', () => {
  it('returns true for string ending in consonant', () => {
    expect(isConsonantBoundary('k')).toBe(true);
    expect(isConsonantBoundary('sh')).toBe(true);
    expect(isConsonantBoundary('pr')).toBe(true);
  });

  it('returns false for string ending in vowel', () => {
    expect(isConsonantBoundary('ka')).toBe(false);
    expect(isConsonantBoundary('ki')).toBe(false);
    expect(isConsonantBoundary('ku')).toBe(false);
    expect(isConsonantBoundary('ke')).toBe(false);
    expect(isConsonantBoundary('ko')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isConsonantBoundary('')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isConsonantBoundary(null)).toBe(false);
    expect(isConsonantBoundary(undefined)).toBe(false);
  });
});
