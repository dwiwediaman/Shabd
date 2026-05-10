import { navigate } from '../components/router.js';
import { createTileGrid } from '../components/tileGrid.js';
import { createKeyboard, DEVANAGARI_MODIFIERS } from '../components/keyboard.js';
import { get, recordCompletion, saveSession, getSession, refreshFreezes } from '../game/gameState.js';
import { today, forDate } from '../game/seedEngine.js';
import { generate, validateGuess, renderShareGrid, splitTiles, normalize } from '../game/wordleMechanic.js';
import { shareImage, preRenderShare, preloadShareFonts } from '../game/shareImage.js';
import { t } from '../i18n.js';
import { feedbackKeyPress, feedbackBackspace, feedbackInvalid, feedbackTileReveal, feedbackWin, feedbackLoss, feedbackHint } from '../feedback.js';

export async function dailyPuzzleScreen(root, { mode = 'daily', date: archiveDate } = {}) {
  const state = get();
  const lang  = state.settings.lang;
  const tx    = t(lang);

  // Generate puzzle
  const puzzleInfo = mode === 'archive'
    ? await forDate(archiveDate, lang)
    : await today(lang);
  const puzzle = generate(puzzleInfo.seed, lang, puzzleInfo.date);
  const sessionKey = mode === 'practice'
    ? `practice|${Date.now()}`
    : `${puzzleInfo.date}|${lang}`;

  // State
  let history = (mode === 'daily' ? getSession(sessionKey) : null) ?? [];
  let currentRow = history.length;
  let currentInput = new Array(puzzle.tileCount).fill('');
  let _dismissSheet = null;
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
        <div class="hdr-title">${mode === 'daily' ? tx.dayLabel(puzzle.puzzleIndex) : mode === 'archive' ? tx.archiveDay(puzzle.puzzleIndex) : tx.practice}${state.settings.hardMode ? ' <span class="hard-badge">HARD</span>' : ''}</div>
        <button class="hdr-btn hdr-hint" id="hintBtn" title="Hint">
          💡<span class="hint-count" id="hintCount">${MAX_HINTS}</span>
        </button>
        <button class="hdr-btn" id="shareBtn" style="display:none" title="Share">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
      </div>
      <div class="puzzle-progress"><div class="puzzle-progress-fill" id="progressFill"></div></div>
      <div class="attempt-row" id="attemptDots"></div>
      <div id="gridWrap"></div>
      <div id="kbWrap"></div>
      <div class="toast" id="toast"></div>
    </div>
  `;

  // Warm fonts in background so share is instant when game ends
  preloadShareFonts();

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
      // Find last non-hint, non-empty position
      let lastIdx = -1;
      for (let i = currentInput.length - 1; i >= 0; i--) {
        if (currentInput[i] !== '' && !hintedPositions.has(i)) { lastIdx = i; break; }
      }
      if (lastIdx === -1) return;
      feedbackBackspace();
      const chars = [...currentInput[lastIdx]];
      if (chars.length > 1) {
        // Strip last char from akshara (matra/modifier)
        currentInput[lastIdx] = chars.slice(0, -1).join('');
        grid.setLetter(currentRow, lastIdx, currentInput[lastIdx]);
      } else {
        currentInput[lastIdx] = '';
        grid.setLetter(currentRow, lastIdx, '');
      }
      return;
    }

    if (key === 'ENTER') {
      submitGuess();
      return;
    }

    // Devanagari modifier (matra, halant, nukta, etc.) — attaches to last typed akshara
    if (lang === 'hi' && DEVANAGARI_MODIFIERS.has(key)) {
      let lastIdx = -1;
      for (let i = currentInput.length - 1; i >= 0; i--) {
        if (currentInput[i] !== '' && !hintedPositions.has(i)) { lastIdx = i; break; }
      }
      if (lastIdx !== -1) {
        feedbackKeyPress();
        currentInput[lastIdx] += key;
        grid.setLetter(currentRow, lastIdx, currentInput[lastIdx]);
      }
      return;
    }

    // Normal character — fill first empty non-hint slot
    const firstEmpty = currentInput.findIndex((c, i) => c === '' && !hintedPositions.has(i));
    if (firstEmpty !== -1) {
      feedbackKeyPress();
      currentInput[firstEmpty] = lang === 'en' ? key.toUpperCase() : key;
      grid.setLetter(currentRow, firstEmpty, currentInput[firstEmpty]);
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
    if (mode === 'daily' || mode === 'archive') saveSession(sessionKey, history);

    currentRow++;
    currentInput = new Array(puzzle.tileCount).fill('');
    hintedPositions.clear();
    updateProgress();
    updateDots();

    if (result.isCorrect) {
      gameOver = true;
      setTimeout(feedbackWin, tiles.length * 120 + 100);
      showToast(tx.brilliant, 2000);
      if (mode === 'daily') {
        const { freezeUsed } = recordCompletion(lang, true, history.length, puzzleInfo.date);
        if (freezeUsed) setTimeout(() => showToast(tx.freezeUsed, 3000), 2100);
      }
      // Pre-render share image in background while animations play
      preRenderShare(puzzle, history);
      setTimeout(showShareBtn, 1600);
      setTimeout(() => showResultSheet(true), 2400);
    } else if (currentRow >= puzzle.maxGuesses) {
      gameOver = true;
      setTimeout(feedbackLoss, tiles.length * 120 + 100);
      showToast(tx.answer(puzzle.target), 2500);
      if (mode === 'daily') recordCompletion(lang, false, history.length, puzzleInfo.date);
      // Pre-render share image in background while animations play
      preRenderShare(puzzle, history);
      setTimeout(showShareBtn, 2000);
      setTimeout(() => showResultSheet(false), 3000);
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

  async function fetchDefinition(word, language) {
    try {
      const apiLang = language === 'hi' ? 'hi' : 'en';
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/${apiLang}/${encodeURIComponent(word)}`);
      if (!res.ok) return null;
      const data = await res.json();
      const entry = data?.[0];
      const meanings = entry?.meanings?.[0];
      const def = meanings?.definitions?.[0];
      if (!def?.definition) return null;
      return {
        meaning: def.definition,
        example: def.example ?? null,
      };
    } catch {
      return null;
    }
  }

  function showResultSheet(won) {
    document.getElementById('resultSheet')?.remove();
    document.getElementById('resultBackdrop')?.remove();

    const state  = get();
    const stats  = state.stats[lang];
    const streak = state.streak[lang];
    const winPct = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
    const maxDist = Math.max(...stats.dist, 1);

    function getCountdown() {
      const istNow  = Date.now() + 19800000;
      const secsLeft = Math.floor((Math.ceil(istNow / 86400000) * 86400000 - istNow) / 1000);
      return [
        Math.floor(secsLeft / 3600),
        Math.floor((secsLeft % 3600) / 60),
        secsLeft % 60,
      ].map(n => String(n).padStart(2, '0')).join(':');
    }

    const distRows = stats.dist.map((count, i) => {
      const pct = Math.round((count / maxDist) * 100);
      const highlight = won && history.length === i + 1;
      return `
        <div class="dist-row">
          <div class="dist-num">${i + 1}</div>
          <div class="dist-bar-wrap">
            <div class="dist-bar ${highlight ? 'active' : 'inactive'}" style="width:${Math.max(pct, 8)}%">${count}</div>
          </div>
        </div>`;
    }).join('');

    const backdrop = document.createElement('div');
    backdrop.id = 'resultBackdrop';
    backdrop.className = 'result-backdrop';

    const sheet = document.createElement('div');
    sheet.id = 'resultSheet';
    sheet.className = 'result-sheet';
    sheet.innerHTML = `
      <div class="result-handle"></div>
      <div class="result-title">${won ? tx.brilliant : tx.lossTitle(puzzle.target)}</div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-big grad-gold">${streak.current}🔥</div><div class="stat-name">${tx.streak}</div></div>
        <div class="stat-card"><div class="stat-big">${stats.played}</div><div class="stat-name">${tx.played}</div></div>
        <div class="stat-card"><div class="stat-big">${winPct}%</div><div class="stat-name">${tx.winRate}</div></div>
        <div class="stat-card"><div class="stat-big">${streak.max}</div><div class="stat-name">${tx.bestStreak}</div></div>
      </div>
      <div class="result-dist">${distRows}</div>
      <div class="result-countdown">
        <div class="countdown-label">${tx.nextWord}</div>
        <div class="countdown-time" id="sheetCountdown">${getCountdown()}</div>
      </div>
      <div class="result-definition" id="wordDefinition">
        <div class="def-loading">${tx.loadingDef}</div>
      </div>
      <button class="share-btn" id="sheetShareBtn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        ${tx.shareResult}
      </button>
      <button class="sheet-menu-btn" id="sheetMenuBtn">${tx.backToMenu}</button>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);

    requestAnimationFrame(() => {
      sheet.classList.add('result-sheet-open');
      backdrop.classList.add('result-backdrop-open');
    });

    // Fetch word definition async
    fetchDefinition(puzzle.target, lang).then(def => {
      const el = document.getElementById('wordDefinition');
      if (!el) return;
      if (def) {
        el.innerHTML = `
          <div class="def-word">${puzzle.target}</div>
          <div class="def-meaning">${def.meaning}</div>
          ${def.example ? `<div class="def-example">"${def.example}"</div>` : ''}
        `;
      } else {
        el.remove();
      }
    });

    const countdownTimer = setInterval(() => {
      const el = document.getElementById('sheetCountdown');
      if (!el) { clearInterval(countdownTimer); return; }
      el.textContent = getCountdown();
    }, 1000);

    function dismiss() {
      sheet.classList.remove('result-sheet-open');
      backdrop.classList.remove('result-backdrop-open');
      setTimeout(() => { sheet.remove(); backdrop.remove(); }, 350);
      clearInterval(countdownTimer);
      _dismissSheet = null;
    }

    _dismissSheet = () => { clearInterval(countdownTimer); sheet.remove(); backdrop.remove(); };

    backdrop.addEventListener('click', dismiss);
    sheet.querySelector('#sheetShareBtn').addEventListener('click', () => { share(); });
    sheet.querySelector('#sheetMenuBtn').addEventListener('click', () => navigate('menu'));
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
    onLeave() {
      document.removeEventListener('keydown', onKeydown);
      _dismissSheet?.();
    }
  };
}
