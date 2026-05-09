// On-screen keyboard component
import { TILE_CORRECT, TILE_PRESENT, TILE_ABSENT } from '../game/wordleMechanic.js';

const EN_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
];

// Devanagari two-page layout
const HI_CONSONANT_ROWS = [
  ['क','ख','ग','घ','च','छ','ज','झ'],
  ['ट','ठ','ड','ढ','त','थ','द','ध'],
  ['न','प','फ','ब','भ','म','य','र'],
  ['ENTER','ल','व','श','ष','ह','ण','अा','⌫'],
];

const HI_MATRA_ROWS = [
  ['अ','आ','इ','ई','उ','ऊ','ए','ओ'],
  ['ा','ि','ी','ु','ू','े','ो','ौ'],
  ['ENTER','ं','ँ','ै','ृ','्','़','क','⌫'],
];

// Characters that attach to the previous akshara instead of starting a new one
export const DEVANAGARI_MODIFIERS = new Set([
  'ा','ि','ी','ु','ू','े','ो','ौ','ै','ृ', // vowel matras
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
    buildStaticKeyboard(EN_ROWS, container, keyMap, onKey);
    return { el: container, updateKeys: makeUpdater(keyStates, keyMap) };
  }

  // Devanagari: two-page keyboard
  const consonantPage = document.createElement('div');
  consonantPage.className = 'kb-page';
  const matraPage = document.createElement('div');
  matraPage.className = 'kb-page kb-page-hidden';

  buildPage(HI_CONSONANT_ROWS, consonantPage, keyMap, key => {
    if (key === 'अा') {
      consonantPage.classList.add('kb-page-hidden');
      matraPage.classList.remove('kb-page-hidden');
    } else {
      onKey(key);
    }
  });

  buildPage(HI_MATRA_ROWS, matraPage, keyMap, key => {
    if (key === 'क') {
      matraPage.classList.add('kb-page-hidden');
      consonantPage.classList.remove('kb-page-hidden');
    } else {
      onKey(key);
    }
  });

  container.appendChild(consonantPage);
  container.appendChild(matraPage);

  return { el: container, updateKeys: makeUpdater(keyStates, keyMap) };
}

function buildStaticKeyboard(rows, container, keyMap, onKey) {
  rows.forEach(row => {
    const rowEl = buildRow(row, keyMap, onKey);
    container.appendChild(rowEl);
  });
}

function buildPage(rows, pageEl, keyMap, onKey) {
  rows.forEach(row => {
    const rowEl = buildRow(row, keyMap, onKey, true);
    pageEl.appendChild(rowEl);
  });
}

function buildRow(row, keyMap, onKey, compact = false) {
  const rowEl = document.createElement('div');
  rowEl.className = 'key-row';

  row.forEach(letter => {
    const btn = document.createElement('button');
    btn.textContent = letter;

    const isEnter = letter === 'ENTER';
    const isBack  = letter === '⌫';
    const isToggle = letter === 'अा' || letter === 'क';
    const isMatra  = DEVANAGARI_MODIFIERS.has(letter);

    btn.className = [
      'key',
      isEnter  ? 'key-enter key-wide' : '',
      isBack   ? 'key-wide' : '',
      isToggle ? 'key-toggle' : '',
      isMatra  ? 'key-matra' : '',
      compact  ? 'key-compact' : '',
    ].filter(Boolean).join(' ');

    btn.addEventListener('click', () => onKey(letter));
    rowEl.appendChild(btn);

    // Register in keyMap (for colour updates after guesses)
    if (!isEnter && !isBack && !isToggle) {
      keyMap[letter] = btn;
    }
  });

  return rowEl;
}

function makeUpdater(keyStates, keyMap) {
  return function updateKeys(perTileState, letters) {
    letters.forEach((letter, i) => {
      // For Devanagari aksharas, update each unicode char in the akshara
      const chars = letter.length > 1 ? [...letter] : [letter];
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
