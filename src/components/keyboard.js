// On-screen keyboard component
import { TILE_CORRECT, TILE_PRESENT, TILE_ABSENT } from '../game/wordleMechanic.js';

const EN_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
];

// ── Devanagari layout (InScript-inspired) ─────────────────────────────
// Always-visible matra strip — same pattern as GBoard/InScript
const HI_MATRA_STRIP = ['ा','ि','ी','ु','ू','े','ो','ौ','ं','ँ','्','़'];

// Consonant rows — all 31 consonants + special keys
const HI_CONSONANT_ROWS = [
  ['क','ख','ग','घ','च','छ','ज','झ'],
  ['ट','ड','त','थ','द','ध','न','प'],
  ['फ','ब','भ','म','य','र','ल','व'],
  ['ENTER','श','ष','ह','ण','स','ठ','अा','⌫'],
];

// Vowel page (toggle) — standalone vowels + rare matras
const HI_VOWEL_ROWS = [
  ['अ','आ','इ','ई','उ','ऊ','ए','ओ'],
  ['औ','ऐ','ॉ','ऑ','ऋ','ः','ै','ृ'],
  ['ENTER','ढ','ञ','ङ','ठ','क','⌫'],
];

// Characters that attach to the previous akshara instead of starting a new one
export const DEVANAGARI_MODIFIERS = new Set([
  'ा','ि','ी','ु','ू','े','ो','ौ','ै','ृ', // vowel matras
  'ॉ',                                        // o-matra for loanwords
  'ं','ँ','ः',                               // anusvara, chandrabindu, visarga
  '्',                                        // halant/virama
  '़',                                        // nukta
]);

export function createKeyboard(lang, onKey) {
  const keyStates = {};
  const keyMap = {};

  const container = document.createElement('div');
  container.className = 'keyboard';

  if (lang !== 'hi') {
    buildRows(EN_ROWS, container, keyMap, onKey);
    return { el: container, updateKeys: makeUpdater(keyStates, keyMap) };
  }

  // ── Devanagari: matra strip + consonants (always visible) + vowel toggle page
  const mainPage = document.createElement('div');
  mainPage.className = 'kb-page';

  const vowelPage = document.createElement('div');
  vowelPage.className = 'kb-page kb-page-hidden';

  // Matra strip — always on top of main page
  const stripRow = buildRow(HI_MATRA_STRIP, keyMap, onKey, 'strip');
  mainPage.appendChild(stripRow);

  // Consonant rows
  buildRows(HI_CONSONANT_ROWS, mainPage, keyMap, key => {
    if (key === 'अा') {
      mainPage.classList.add('kb-page-hidden');
      vowelPage.classList.remove('kb-page-hidden');
    } else {
      onKey(key);
    }
  }, 'compact');

  // Vowel page
  buildRows(HI_VOWEL_ROWS, vowelPage, keyMap, key => {
    if (key === 'क') {
      vowelPage.classList.add('kb-page-hidden');
      mainPage.classList.remove('kb-page-hidden');
    } else {
      onKey(key);
    }
  }, 'compact');

  container.appendChild(mainPage);
  container.appendChild(vowelPage);

  return { el: container, updateKeys: makeUpdater(keyStates, keyMap) };
}

function buildRows(rows, parent, keyMap, onKey, style = '') {
  rows.forEach(row => {
    parent.appendChild(buildRow(row, keyMap, onKey, style));
  });
}

function buildRow(row, keyMap, onKey, style = '') {
  const rowEl = document.createElement('div');
  rowEl.className = 'key-row';

  row.forEach(letter => {
    const btn = document.createElement('button');
    btn.textContent = letter;

    const isEnter  = letter === 'ENTER';
    const isBack   = letter === '⌫';
    const isToggle = letter === 'अा' || letter === 'क';
    const isMatra  = DEVANAGARI_MODIFIERS.has(letter);
    const isStrip  = style === 'strip';

    btn.className = [
      'key',
      isEnter  ? 'key-enter key-wide' : '',
      isBack   ? 'key-wide' : '',
      isToggle ? 'key-toggle' : '',
      isMatra  ? 'key-matra' : '',
      isStrip  ? 'key-strip' : '',
      (style === 'compact' && !isEnter && !isBack) ? 'key-compact' : '',
    ].filter(Boolean).join(' ');

    btn.addEventListener('click', () => onKey(letter));
    rowEl.appendChild(btn);

    if (!isEnter && !isBack && !isToggle) {
      keyMap[letter] = btn;
    }
  });

  return rowEl;
}

function makeUpdater(keyStates, keyMap) {
  return function updateKeys(perTileState, letters) {
    letters.forEach((letter, i) => {
      const chars = [...letter]; // Unicode-safe
      const state = perTileState[i];
      chars.forEach(ch => {
        const existing = keyStates[ch];
        if (existing === TILE_CORRECT) return;
        if (existing === TILE_PRESENT && state !== TILE_CORRECT) return;
        keyStates[ch] = state;
        const btn = keyMap[ch] || keyMap[ch.toUpperCase()];
        if (btn) {
          btn.classList.remove('key-correct', 'key-present', 'key-absent');
          btn.classList.add(`key-${state}`);
        }
      });
    });
  };
}
