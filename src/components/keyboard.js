// On-screen keyboard component
import { TILE_CORRECT, TILE_PRESENT, TILE_ABSENT } from '../game/wordleMechanic.js';

const EN_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
];

const HI_ROWS = [
  ['क','ख','ग','घ','च','छ','ज','झ'],
  ['ट','ठ','ड','त','थ','द','न','प'],
  ['ENTER','ब','म','य','र','ल','⌫'],
];

export function createKeyboard(lang, onKey) {
  const rows = lang === 'hi' ? HI_ROWS : EN_ROWS;
  const keyStates = {}; // letter -> state

  const container = document.createElement('div');
  container.className = 'keyboard';

  const keyMap = {}; // letter -> button el

  rows.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'key-row';

    row.forEach(letter => {
      const btn = document.createElement('button');
      btn.textContent = letter;
      btn.className = `key${letter === 'ENTER' ? ' key-enter' : letter === '⌫' ? ' key-wide' : ''}`;
      if (letter === 'ENTER') btn.classList.add('key-wide');
      btn.addEventListener('click', () => onKey(letter));
      rowEl.appendChild(btn);
      keyMap[letter] = btn;
    });

    container.appendChild(rowEl);
  });

  function updateKeys(perTileState, letters) {
    letters.forEach((letter, i) => {
      const state = perTileState[i];
      const existing = keyStates[letter];
      // Priority: correct > present > absent
      if (existing === TILE_CORRECT) return;
      if (existing === TILE_PRESENT && state !== TILE_CORRECT) return;
      keyStates[letter] = state;
      const btn = keyMap[letter] || keyMap[letter.toUpperCase()];
      if (btn) {
        btn.classList.remove('key-correct', 'key-present', 'key-absent');
        btn.classList.add(`key-${state}`);
      }
    });
  }

  return { el: container, updateKeys };
}
