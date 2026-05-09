// TileGrid component
import { TILE_CORRECT, TILE_PRESENT, TILE_ABSENT } from '../game/wordleMechanic.js';

export function createTileGrid(tileCount, maxGuesses) {
  const grid = document.createElement('div');
  grid.className = 'tile-grid';

  const rows = [];
  for (let r = 0; r < maxGuesses; r++) {
    const row = document.createElement('div');
    row.className = 'tile-row';
    const tiles = [];
    for (let c = 0; c < tileCount; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile tile-empty';
      row.appendChild(tile);
      tiles.push(tile);
    }
    grid.appendChild(row);
    rows.push({ row, tiles });
  }

  function setLetter(rowIndex, colIndex, letter) {
    const tile = rows[rowIndex].tiles[colIndex];
    // Don't overwrite a hint tile with empty
    if (!letter && tile.className.includes('tile-hint')) return;
    tile.textContent = letter;
    tile.className = letter ? 'tile tile-active' : 'tile tile-empty';
  }

  function revealRow(rowIndex, perTileState, letters) {
    const { tiles } = rows[rowIndex];
    tiles.forEach((tile, i) => {
      tile.textContent = letters[i] ?? '';
      // Stagger the flip animation
      setTimeout(() => {
        tile.className = `tile tile-${perTileState[i]}`;
        tile.style.animationDelay = '';
      }, i * 120);
    });
  }

  function shakeRow(rowIndex) {
    const { row } = rows[rowIndex];
    row.classList.add('shake');
    row.addEventListener('animationend', () => row.classList.remove('shake'), { once: true });
  }

  function restoreHistory(history, tileCount) {
    history.forEach((guess, r) => {
      const letters = [...guess.input].slice(0, tileCount); // crude; works for en
      guess.perTileState.forEach((state, c) => {
        const tile = rows[r].tiles[c];
        tile.textContent = letters[c] ?? '';
        tile.className = `tile tile-${state}`;
      });
    });
  }

  function setHintLetter(rowIndex, colIndex, letter) {
    const tile = rows[rowIndex].tiles[colIndex];
    tile.textContent = letter;
    tile.className = 'tile tile-hint';
  }

  return { el: grid, setLetter, revealRow, shakeRow, restoreHistory, setHintLetter };
}
