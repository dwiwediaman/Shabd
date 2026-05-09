import { navigate } from '../components/router.js';
import { createTileGrid } from '../components/tileGrid.js';
import { createKeyboard } from '../components/keyboard.js';
import { get, recordCompletion, saveSession, getSession } from '../game/gameState.js';
import { today } from '../game/seedEngine.js';
import { generate, validateGuess, renderShareGrid, splitTiles, normalize } from '../game/wordleMechanic.js';
import { t } from '../i18n.js';

export async function dailyPuzzleScreen(root, { mode = 'daily' }) {
  const state = get();
  const lang  = state.settings.lang;
  const tx    = t(lang);

  // Generate puzzle
  const todayInfo = await today(lang);
  const puzzle = generate(todayInfo.seed, lang, todayInfo.date);
  const sessionKey = mode === 'daily' ? `${todayInfo.date}|${lang}` : `practice|${Date.now()}`;

  // State
  let history = (mode === 'daily' ? getSession(sessionKey) : null) ?? [];
  let currentRow = history.length;
  let currentInput = [];
  let gameOver = history.length > 0 && (
    history[history.length - 1]?.isCorrect ||
    history.length >= puzzle.maxGuesses
  );

  // Build UI
  root.innerHTML = `
    <div class="stars" id="pzStars"></div>
    <div class="orb orb-1"></div>
    <div class="puzzle-screen">
      <div class="puzzle-header">
        <button class="hdr-btn" id="backBtn">←</button>
        <div class="hdr-title">${mode === 'daily' ? tx.dayLabel(puzzle.puzzleIndex) : tx.practice}</div>
        <button class="hdr-btn" id="shareBtn" style="display:none">↗</button>
      </div>
      <div class="puzzle-progress"><div class="puzzle-progress-fill" id="progressFill"></div></div>
      <div class="attempt-row" id="attemptDots"></div>
      <div id="gridWrap"></div>
      <div id="kbWrap"></div>
      <div class="toast" id="toast"></div>
    </div>
  `;

  spawnStars('pzStars');

  // Grid + keyboard
  const grid = createTileGrid(puzzle.tileCount, puzzle.maxGuesses);
  const keyboard = createKeyboard(lang, handleKey);
  document.getElementById('gridWrap').appendChild(grid.el);
  document.getElementById('kbWrap').appendChild(keyboard.el);

  // Restore history
  if (history.length) {
    history.forEach((guess, r) => {
      const tiles = splitTiles(guess.input, lang);
      grid.revealRow(r, guess.perTileState, tiles);
      keyboard.updateKeys(guess.perTileState, tiles);
    });
  }

  updateProgress();
  updateDots();

  if (gameOver) showShareBtn();

  // Back
  document.getElementById('backBtn').addEventListener('click', () => navigate('menu'));
  document.getElementById('shareBtn').addEventListener('click', share);

  // Physical keyboard
  const onKeydown = e => {
    if (e.key === 'Enter') handleKey('ENTER');
    else if (e.key === 'Backspace') handleKey('⌫');
    else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
  };
  document.addEventListener('keydown', onKeydown);

  function handleKey(key) {
    if (gameOver) return;

    if (key === '⌫') {
      if (currentInput.length > 0) {
        currentInput.pop();
        grid.setLetter(currentRow, currentInput.length, '');
      }
      return;
    }

    if (key === 'ENTER') {
      submitGuess();
      return;
    }

    if (currentInput.length < puzzle.tileCount) {
      currentInput.push(lang === 'en' ? key.toUpperCase() : key);
      grid.setLetter(currentRow, currentInput.length - 1, currentInput[currentInput.length - 1]);
    }
  }

  function submitGuess() {
    const word = currentInput.join('');
    const result = validateGuess(word, puzzle);

    if (!result.isValid) {
      grid.shakeRow(currentRow);
      showToast(result.rejectionReason === 'wrong_length' ? tx.notEnoughLetters : tx.notInWordList);
      return;
    }

    const tiles = splitTiles(word, lang);
    grid.revealRow(currentRow, result.perTileState, tiles);
    keyboard.updateKeys(result.perTileState, tiles);

    history.push(result);
    if (mode === 'daily') saveSession(sessionKey, history);

    currentRow++;
    currentInput = [];
    updateProgress();
    updateDots();

    if (result.isCorrect) {
      gameOver = true;
      showToast(tx.brilliant, 2500);
      if (mode === 'daily') recordCompletion(lang, true, history.length, todayInfo.date);
      setTimeout(showShareBtn, 1600);
    } else if (currentRow >= puzzle.maxGuesses) {
      gameOver = true;
      showToast(tx.answer(puzzle.target), 3000);
      if (mode === 'daily') recordCompletion(lang, false, history.length, todayInfo.date);
      setTimeout(showShareBtn, 2000);
    }
  }

  function updateProgress() {
    const pct = (currentRow / puzzle.maxGuesses) * 100;
    document.getElementById('progressFill').style.width = pct + '%';
  }

  function updateDots() {
    const container = document.getElementById('attemptDots');
    container.innerHTML = '';
    for (let i = 0; i < puzzle.maxGuesses; i++) {
      const dot = document.createElement('div');
      dot.className = 'attempt-dot' + (i < currentRow ? ' used' : i === currentRow && !gameOver ? ' active' : '');
      container.appendChild(dot);
    }
  }

  function showToast(msg, duration = 1600) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration);
  }

  function showShareBtn() {
    document.getElementById('shareBtn').style.display = 'flex';
  }

  function share() {
    const text = renderShareGrid(puzzle, history);
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text);
      showToast(tx.copied);
    }
  }

  function spawnStars(id) {
    const el = document.getElementById(id);
    if (!el) return;
    for (let i = 0; i < 40; i++) {
      const s = document.createElement('div');
      s.className = 'star';
      const sz = Math.random() * 2 + 0.5;
      s.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random()*100}%;top:${Math.random()*60}%;animation-delay:${Math.random()*3}s;animation-duration:${2+Math.random()*3}s;`;
      el.appendChild(s);
    }
  }

  return {
    onLeave() { document.removeEventListener('keydown', onKeydown); }
  };
}
