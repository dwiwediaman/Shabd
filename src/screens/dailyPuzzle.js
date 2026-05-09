import { navigate } from '../components/router.js';
import { createTileGrid } from '../components/tileGrid.js';
import { createKeyboard, DEVANAGARI_MODIFIERS } from '../components/keyboard.js';
import { get, recordCompletion, saveSession, getSession, refreshFreezes } from '../game/gameState.js';
import { today } from '../game/seedEngine.js';
import { generate, validateGuess, renderShareGrid, splitTiles, normalize } from '../game/wordleMechanic.js';
import { shareImage } from '../game/shareImage.js';
import { t } from '../i18n.js';
import { feedbackKeyPress, feedbackBackspace, feedbackInvalid, feedbackTileReveal, feedbackWin, feedbackLoss, feedbackHint } from '../feedback.js';

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

  const MAX_HINTS = 3;
  let hintsLeft = MAX_HINTS;
  const hintedPositions = new Set();

  // Build UI
  root.innerHTML = `
    <div class="stars" id="pzStars"></div>
    <div class="orb orb-1"></div>
    <div class="puzzle-screen">
      <div class="puzzle-header">
        <button class="hdr-btn" id="backBtn">←</button>
        <div class="hdr-title">${mode === 'daily' ? tx.dayLabel(puzzle.puzzleIndex) : tx.practice}${state.settings.hardMode ? ' <span class="hard-badge">HARD</span>' : ''}</div>
        <button class="hdr-btn hdr-hint" id="hintBtn" title="Hint">
          💡<span class="hint-count" id="hintCount">${MAX_HINTS}</span>
        </button>
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

  // Back / share
  document.getElementById('backBtn').addEventListener('click', () => navigate('menu'));
  document.getElementById('shareBtn').addEventListener('click', share);

  // Hint
  document.getElementById('hintBtn').addEventListener('click', () => {
    if (gameOver || hintsLeft <= 0) return;

    const targetTiles = splitTiles(puzzle.target, lang);

    // Find positions not yet correctly guessed and not already hinted
    const correctPositions = new Set();
    history.forEach(g => {
      g.perTileState.forEach((s, i) => { if (s === 'correct') correctPositions.add(i); });
    });

    const available = targetTiles
      .map((_, i) => i)
      .filter(i => !correctPositions.has(i) && !hintedPositions.has(i));

    if (available.length === 0) return;

    const pos = available[Math.floor(Math.random() * available.length)];
    const letter = targetTiles[pos];
    hintedPositions.add(pos);
    hintsLeft--;

    // Show in grid and pre-fill current input
    grid.setHintLetter(currentRow, pos, letter);
    currentInput[pos] = letter;

    // Update badge
    const badge = document.getElementById('hintCount');
    if (badge) badge.textContent = hintsLeft;
    if (hintsLeft === 0) {
      const btn = document.getElementById('hintBtn');
      if (btn) btn.style.opacity = '0.35';
    }

    feedbackHint();
    showToast(tx.hintRevealed(pos + 1));
  });

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
        feedbackBackspace();
        const last = currentInput[currentInput.length - 1];
        const chars = [...last]; // Unicode-safe split
        if (chars.length > 1) {
          // Strip last char from the current akshara (remove matra/modifier)
          currentInput[currentInput.length - 1] = chars.slice(0, -1).join('');
          grid.setLetter(currentRow, currentInput.length - 1, currentInput[currentInput.length - 1]);
        } else {
          currentInput.pop();
          grid.setLetter(currentRow, currentInput.length, '');
        }
      }
      return;
    }

    if (key === 'ENTER') {
      submitGuess();
      return;
    }

    // Devanagari modifier (matra, halant, nukta, etc.) — attaches to last akshara
    if (lang === 'hi' && DEVANAGARI_MODIFIERS.has(key)) {
      if (currentInput.length > 0) {
        feedbackKeyPress();
        currentInput[currentInput.length - 1] += key;
        grid.setLetter(currentRow, currentInput.length - 1, currentInput[currentInput.length - 1]);
      }
      return;
    }

    if (currentInput.length < puzzle.tileCount) {
      feedbackKeyPress();
      currentInput.push(lang === 'en' ? key.toUpperCase() : key);
      grid.setLetter(currentRow, currentInput.length - 1, currentInput[currentInput.length - 1]);
    }
  }

  function checkHardMode(word) {
    const tiles = splitTiles(word, lang);
    for (const guess of history) {
      const gTiles = splitTiles(guess.input, lang);
      for (let i = 0; i < guess.perTileState.length; i++) {
        if (guess.perTileState[i] === 'correct' && tiles[i] !== gTiles[i]) {
          return tx.hardModeCorrect(i + 1, gTiles[i]);
        }
      }
      for (let i = 0; i < guess.perTileState.length; i++) {
        if (guess.perTileState[i] === 'present' && !tiles.includes(gTiles[i])) {
          return tx.hardModePresent(gTiles[i]);
        }
      }
    }
    return null;
  }

  function submitGuess() {
    const word = currentInput.join('');
    const result = validateGuess(word, puzzle);

    if (!result.isValid) {
      feedbackInvalid();
      grid.shakeRow(currentRow);
      showToast(result.rejectionReason === 'wrong_length' ? tx.notEnoughLetters : tx.notInWordList);
      return;
    }

    if (get().settings.hardMode && history.length > 0) {
      const hardErr = checkHardMode(word);
      if (hardErr) {
        feedbackInvalid();
        grid.shakeRow(currentRow);
        showToast(hardErr);
        return;
      }
    }

    const tiles = splitTiles(word, lang);
    tiles.forEach((_, i) => feedbackTileReveal(i));
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
      setTimeout(feedbackWin, tiles.length * 120 + 100);
      showToast(tx.brilliant, 2500);
      if (mode === 'daily') {
        const { freezeUsed } = recordCompletion(lang, true, history.length, todayInfo.date);
        if (freezeUsed) setTimeout(() => showToast(tx.freezeUsed, 3000), 2600);
      }
      setTimeout(showShareBtn, 1600);
    } else if (currentRow >= puzzle.maxGuesses) {
      gameOver = true;
      setTimeout(feedbackLoss, tiles.length * 120 + 100);
      showToast(tx.answer(puzzle.target), 3000);
      if (mode === 'daily') recordCompletion(lang, false, history.length, todayInfo.date);
      // (losses never use freeze — freeze only protects missed days)
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
    document.getElementById('hintBtn').style.display = 'none';
    document.getElementById('shareBtn').style.display = 'flex';
  }

  async function share() {
    const text   = renderShareGrid(puzzle, history);
    const result = await shareImage(puzzle, history, text);
    if (result === 'downloaded') showToast(tx.imageSaved);
    else if (result === 'text')  showToast(tx.copied);
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
