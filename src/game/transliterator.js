// HinglishTransliterator — mirrors hinglish_transliterator.gd
let _canonical = null;

export async function loadTransliterator() {
  if (_canonical) return;
  const res = await fetch('/data/hinglish_canonical.json');
  _canonical = await res.json();
}

export function transliterateChunk(roman) {
  const key = roman.toLowerCase().trim();
  const entry = _canonical?.[key];
  if (entry) {
    const candidates = entry.candidates ?? [entry.canonical ?? ''];
    return { akshara: entry.canonical ?? '', candidates, confident: candidates.length <= 1 };
  }
  return { akshara: '', candidates: [], confident: false };
}

export function isConsonantBoundary(roman) {
  if (!roman) return false;
  return !'aeiouAEIOU'.includes(roman[roman.length - 1]);
}
