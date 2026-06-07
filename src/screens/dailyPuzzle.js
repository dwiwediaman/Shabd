import { navigate, goBack } from '../components/router.js';
import { createTileGrid } from '../components/tileGrid.js';
import { createKeyboard, DEVANAGARI_MODIFIERS } from '../components/keyboard.js';
import { spawnStars, escapeHtml } from '../components/ui.js';
import { get, recordCompletion, saveSession, getSession, getSessionMeta, setSessionMeta, refreshFreezes } from '../game/gameState.js';
import { today, forDate } from '../game/seedEngine.js';
import { generate, validateGuess, renderShareGrid, splitTiles, normalize, findClosestGuess } from '../game/wordleMechanic.js';
import { shareImage, preRenderShare, preloadShareFonts } from '../game/shareImage.js';
import { isSignedIn } from '../cloud/auth.js';
import { submitScore } from '../cloud/sync.js';
import { listMySquads, getSquadBoard } from '../cloud/squads.js';
import { t } from '../i18n.js';
import { feedbackKeyPress, feedbackBackspace, feedbackInvalid, feedbackTileReveal, feedbackWin, feedbackLoss, feedbackHint } from '../feedback.js';
import { refreshDailyReminders } from '../notifications.js';

// Tear down any of today's remaining reminders once the daily puzzle is
// finished. Wrapped so it's safe to call from win/loss branches without
// blocking the result-sheet animation timeline. No-op if the user has
// notifications disabled in settings.
function cancelTodayRemindersIfNotificationsOn() {
  const s = get().settings;
  if (!s?.notifications) return;
  // refreshDailyReminders reads the just-saved session via getSession and
  // therefore skips today entirely when its last guess is a win/loss.
  refreshDailyReminders({ lang: s.lang }).catch(() => {});
}

export async function dailyPuzzleScreen(root, { mode = 'daily', date: archiveDate } = {}) {
  const state = get();
  const lang  = state.settings.lang;
  const tx    = t(lang);

  // Practice Mode was removed in vc76 (card hidden) / vc77 (route fully
  // collapsed here). Any lingering navigate('puzzle', { mode: 'practice' })
  // — e.g. an old share intent — is silently coerced to a daily play.
  if (mode === 'practice') mode = 'daily';

  // Generate puzzle
  const puzzleInfo = mode === 'archive'
    ? await forDate(archiveDate, lang)
    : await today(lang);
  const puzzle = generate(puzzleInfo.seed, lang, puzzleInfo.date);
  const sessionKey = `${puzzleInfo.date}|${lang}`;

  // State
  // Archive sessions are persisted (see saveSession below), so restore them
  // on entry too — otherwise tapping a played calendar cell opens an empty
  // grid even though the cell is coloured won/lost.
  const persistedHistory = (mode === 'daily' || mode === 'archive')
    ? getSession(sessionKey) : null;
  let history = persistedHistory ?? [];
  let currentRow = history.length;
  let currentInput = new Array(puzzle.tileCount).fill('');
  let _dismissSheet = null;
  let gameOver = history.length > 0 && (
    history[history.length - 1]?.isCorrect ||
    history.length >= puzzle.maxGuesses
  );

  const MAX_HINTS = 3;
  // Restore hints used from prior session (e.g. user backgrounded mid-game).
  const persistedMeta = (mode === 'daily' || mode === 'archive')
    ? getSessionMeta(sessionKey) : { hintsUsed: 0 };
  let hintsUsedSoFar = persistedMeta.hintsUsed ?? 0;
  let hintsLeft = Math.max(0, MAX_HINTS - hintsUsedSoFar);
  const hintedPositions = new Set();
  // Word/topic hint (vc98): 1 per game, separate budget from letter hints.
  // Reveals a masked dictionary definition so the user can narrow the
  // concept without seeing letters. Persisted + replayed across re-entry.
  let wordHintUsed = !!persistedMeta.wordHintUsed;
  let wordHintText = persistedMeta.wordHintText ?? null;
  // Pending hints belong to the CURRENT (unsubmitted) row. Persisted so the
  // user sees the hinted letter after leaving + re-entering — otherwise the
  // counter ticks down but the pre-filled tile is gone, looking like the
  // hint was silently swallowed. Cleared whenever a row is submitted.
  const persistedPending = (persistedMeta.pendingHints?.row === history.length)
    ? (persistedMeta.pendingHints.items || [])
    : [];
  // Game-start timestamp for durationMs measurement.
  const gameStartedAt = Date.now();

  // Build UI
  root.innerHTML = `
    <div class="stars" id="pzStars"></div>
    <div class="orb orb-1"></div>
    <div class="puzzle-screen">
      <div class="puzzle-header">
        <button class="hdr-btn" id="backBtn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div class="hdr-title">${mode === 'archive' ? tx.archiveDay(puzzle.puzzleIndex) : tx.dayLabel(puzzle.puzzleIndex)}${mode !== 'archive' && state.settings.hardMode ? ' <span class="hard-badge">HARD</span>' : ''}</div>
        <button class="hdr-btn hdr-hint" id="wordHintBtn" title="${tx.wordHintTitle}"${wordHintUsed ? ' style="opacity:0.35"' : ''}>
          💭<span class="hint-count" id="wordHintCount">${wordHintUsed ? 0 : 1}</span>
        </button>
        <button class="hdr-btn hdr-hint" id="hintBtn" title="${tx.letterHintTitle}"${hintsLeft === 0 ? ' style="opacity:0.35"' : ''}>
          💡<span class="hint-count" id="hintCount">${hintsLeft}</span>
        </button>
        <button class="hdr-btn" id="shareBtn" style="display:none" title="Share">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
      </div>
      <div class="puzzle-progress"><div class="puzzle-progress-fill" id="progressFill"></div></div>
      <div class="attempt-row" id="attemptDots"></div>
      <div class="word-hint-banner" id="wordHintBanner" style="display:none"></div>
      <div id="gridWrap"></div>
      <div class="answer-reveal" id="answerReveal" style="display:none"></div>
      <div id="kbWrap"></div>
      <div class="toast" id="toast"></div>
    </div>
  `;

  // Warm fonts in background so share is instant when game ends
  preloadShareFonts();

  spawnStars('pzStars', 40);

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

  // Re-apply persisted pending hints for the current (unsubmitted) row.
  // Rescue: a bug in vc86–vc99 persisted the most-recent hint as
  // letter:'' (the click handler serialised BEFORE writing currentInput).
  // Drop those empty items, repaint only the valid ones, refund the
  // hintsUsed counter so the user gets back the hint they paid for.
  if (persistedPending.length && !gameOver) {
    const valid   = persistedPending.filter(it => it && it.letter);
    const refund  = persistedPending.length - valid.length;
    valid.forEach(({ pos, letter }) => {
      hintedPositions.add(pos);
      currentInput[pos] = letter;
      grid.setHintLetter(currentRow, pos, letter);
    });
    if (refund > 0) {
      hintsUsedSoFar = Math.max(0, hintsUsedSoFar - refund);
      hintsLeft      = Math.max(0, MAX_HINTS - hintsUsedSoFar);
      if (mode === 'daily' || mode === 'archive') {
        setSessionMeta(sessionKey, {
          hintsUsed:    hintsUsedSoFar,
          pendingHints: valid.length ? { row: currentRow, items: valid } : null,
        });
      }
    }
  }

  // Re-show the topic-hint banner if the user previously tapped it. We
  // cached the text in sessionMeta so a re-entry doesn't require another
  // network fetch (the dictionary API is slow on flaky connections).
  if (wordHintUsed && wordHintText) {
    renderWordHintBanner(wordHintText);
  } else {
    // No banner — still run once in case viewport is unusually short
    requestAnimationFrame(fitGrid);
  }

  updateProgress();
  updateDots();

  if (gameOver) showShareBtn();

  // On re-entry after a loss, show the answer banner immediately (the
  // in-game toast has long expired and the result sheet won't re-open).
  if (gameOver && !history[history.length - 1]?.isCorrect) {
    showAnswerReveal();
  }

  // Re-entry into a completed game: show the result sheet (definition,
  // stats, countdown) automatically. Without this the user can see the
  // solved grid but has no way to read the word meaning.
  if (gameOver) {
    const won = history[history.length - 1]?.isCorrect ?? false;
    setTimeout(() => showResultSheet(won), 350);
  }

  // Back / share
  // Honour the navigation stack so back from an archive puzzle returns to
  // the calendar (not menu), while back from a daily puzzle still lands on
  // menu since that's the only path in.
  document.getElementById('backBtn').addEventListener('click', () => goBack());
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
    hintsUsedSoFar++;

    // Apply to the in-memory row FIRST so the persisted snapshot sees the
    // new letter at currentInput[pos]. Earlier we persisted before this
    // assignment, so the just-hinted position got serialised as letter:''
    // — on re-entry that painted the yellow outline with a blank inside.
    grid.setHintLetter(currentRow, pos, letter);
    currentInput[pos] = letter;

    // Persist after the in-memory write so a mid-game close/reopen
    // preserves the cost AND the visible pre-fill.
    // (daily and archive both persist; only daily syncs to cloud later.)
    if (mode === 'daily' || mode === 'archive') {
      const items = [...hintedPositions].map(p => ({ pos: p, letter: currentInput[p] }));
      setSessionMeta(sessionKey, {
        hintsUsed: hintsUsedSoFar,
        pendingHints: { row: currentRow, items },
      });
    }

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

  // Word/topic hint (vc98). One-shot per game. Tap → fetch the
  // dictionary definition → mask the target word out of it → render as a
  // banner under the header. Cached locally so re-entry doesn't refetch.
  document.getElementById('wordHintBtn').addEventListener('click', async () => {
    if (gameOver) return;
    if (wordHintUsed) {
      // Already used — just re-show the banner in case the user scrolled
      // it off-screen or dismissed it accidentally.
      if (wordHintText) renderWordHintBanner(wordHintText);
      return;
    }

    const btn = document.getElementById('wordHintBtn');
    btn.disabled = true;
    showToast(tx.wordHintLoading);

    const def = await fetchDefinition(puzzle.target, lang);
    btn.disabled = false;

    if (!def?.meaning) {
      showToast(tx.wordHintUnavailable);
      return;
    }

    // Mask the target word (case-insensitive, whole-word) so the hint
    // never spoils the answer literally.
    const masked = def.meaning.replace(
      new RegExp(`\\b${escapeRegex(puzzle.target)}\\b`, 'gi'),
      '___'
    );
    wordHintText = masked;
    wordHintUsed = true;
    if (mode === 'daily' || mode === 'archive') {
      setSessionMeta(sessionKey, {
        wordHintUsed: true,
        wordHintText: masked,
      });
    }

    renderWordHintBanner(masked);
    btn.style.opacity = '0.35';
    const badge = document.getElementById('wordHintCount');
    if (badge) badge.textContent = '0';
    feedbackHint();
  });

  function renderWordHintBanner(text) {
    const el = document.getElementById('wordHintBanner');
    if (!el) return;
    el.innerHTML = `<span class="word-hint-label">${tx.wordHintLabel}</span> ${escapeHtml(text)}`;
    el.style.display = 'block';
    // After banner renders, scale the tile grid so it fits the remaining space
    // and the keyboard is never pushed off-screen.
    requestAnimationFrame(fitGrid);
  }

  // Scale the tile grid down to fit inside #gridWrap when the banner
  // reduces available vertical space. Uses transform:scale so tile
  // positions / touch targets stay visually accurate.
  function fitGrid() {
    const wrap = document.getElementById('gridWrap');
    const tileGrid = wrap?.querySelector('.tile-grid');
    if (!wrap || !tileGrid) return;
    tileGrid.style.transform = ''; // reset before measuring natural size
    const availH = wrap.clientHeight;
    const naturalH = tileGrid.scrollHeight;
    if (availH > 0 && naturalH > availH) {
      const scale = availH / naturalH;
      tileGrid.style.transform = `scale(${scale})`;
      tileGrid.style.transformOrigin = 'top center';
    }
  }

  function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
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
      if (result.rejectionReason === 'wrong_length') {
        showToast(tx.notEnoughLetters);
      } else {
        // Spell-suggest (vc99): probe the guess pool for the nearest
        // valid same-length word. If found within 2 tile edits, offer it
        // as a tappable suggestion instead of the bare "Not in word
        // list" message. Cuts the friction of a typo in an otherwise
        // sensible guess.
        const suggestion = findClosestGuess(word, lang, { maxDist: 2 });
        if (suggestion) {
          showSpellSuggestion(suggestion);
        } else {
          showToast(tx.notInWordList);
        }
      }
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
    if (mode === 'daily' || mode === 'archive') {
      saveSession(sessionKey, history);
      // Submitted row consumes any pending hints — clear so the next row
      // starts fresh and a re-entry doesn't try to re-apply stale hints.
      setSessionMeta(sessionKey, { pendingHints: null });
    }

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
        submitToCloudInBackground(true);
        // Today's session is now finished — refresh reminders so any
        // not-yet-fired notifications for today are cancelled.
        cancelTodayRemindersIfNotificationsOn();
      }
      // Pre-render share image in background while animations play
      preRenderShare(puzzle, history);
      setTimeout(showShareBtn, 1600);
      setTimeout(() => showResultSheet(true), 2400);
    } else if (currentRow >= puzzle.maxGuesses) {
      gameOver = true;
      setTimeout(feedbackLoss, tiles.length * 120 + 100);
      showToast(tx.answer(puzzle.target), 2500);
      if (mode === 'daily') {
        recordCompletion(lang, false, history.length, puzzleInfo.date);
        submitToCloudInBackground(false);
        cancelTodayRemindersIfNotificationsOn();
      }
      // Pre-render share image in background while animations play
      preRenderShare(puzzle, history);
      setTimeout(showShareBtn, 2000);
      setTimeout(() => showResultSheet(false), 3000);
      // Permanently show the answer below the grid — the toast lasts
      // only 2.5 s and the result sheet can be dismissed, leaving the
      // user with no way to see the word.
      setTimeout(showAnswerReveal, tiles.length * 120 + 200);
    } else {
      // Intermediate guess — show an encouraging message after tiles flip.
      // remaining = guesses still available after this one.
      const remaining = puzzle.maxGuesses - history.length;
      const correctCount = result.perTileState.filter(s => s === 'correct').length;
      setTimeout(
        () => showToast(tx.encourage(remaining, correctCount >= 2), 1600),
        tiles.length * 120 + 120
      );
    }
  }

  // Fire-and-forget: send the game result to the cloud anti-cheat endpoint
  // so squad leaderboards update. Failures are silent — the local game state
  // is authoritative for the player's own stats.
  function submitToCloudInBackground(/* won */) {
    if (mode !== 'daily' || !isSignedIn()) return;
    const guesses = history.map(h => h.input);
    const durationMs = Date.now() - gameStartedAt;
    // Persist final meta so cold-start backfill picks it up if cloud submit fails
    setSessionMeta(sessionKey, {
      hintsUsed: hintsUsedSoFar,
      wordHintUsed,
      durationMs,
    });
    submitScore({
      date:         puzzleInfo.date,
      lang,
      guesses,
      hardMode:     !!get().settings.hardMode,
      hintsUsed:    hintsUsedSoFar,
      wordHintUsed,
      durationMs,
    }).then(refreshResultSheetRank, () => {});
  }

  // After cloud submit succeeds, look up the user's squads + rank
  // and inject the badge into the result sheet (if it's open).
  async function refreshResultSheetRank() {
    try {
      const squads = await listMySquads();
      if (!squads.length) return;
      const squad = squads[0]; // primary squad — UX: show first one
      const board = await getSquadBoard(squad.squadId, puzzleInfo.date, lang);
      const slot  = document.getElementById('resultRankSlot');
      if (slot) slot.innerHTML = rankBadgeHtml(squad.name, board.myRank, board.memberCount, tx);
    } catch { /* no-op */ }
  }

  function rankBadgeHtml(squadName, rank, total, tx) {
    if (!rank || rank < 1) return '';
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏆';
    const safe  = (s) => String(s).replace(/[&<>"']/g, ch => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
    return `
      <div class="result-rank-badge">
        <div class="result-rank-emoji">${medal}</div>
        <div class="result-rank-text">
          <div class="result-rank-name">${safe(squadName)}</div>
          <div class="result-rank-line">${tx.squadsMyRank(rank, total)}</div>
        </div>
      </div>
    `;
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

  // Spell-suggest toast (vc99) — like showToast but with a tappable button
  // that loads the suggested word into the current row. Lives 5s so the
  // user has time to read + decide; doesn't auto-submit so they can edit
  // first. Hinted positions are preserved on apply.
  function showSpellSuggestion(word) {
    document.getElementById('spellSuggest')?.remove();
    const el = document.createElement('div');
    el.id = 'spellSuggest';
    el.className = 'toast spell-suggest';
    el.innerHTML = `${escapeHtml(tx.didYouMean)} <button type="button" class="spell-suggest-btn">${escapeHtml(word.toUpperCase())}</button>`;
    el.querySelector('button').addEventListener('click', () => {
      const tiles = splitTiles(word, lang);
      for (let i = 0; i < currentInput.length; i++) {
        if (hintedPositions.has(i)) continue; // don't clobber the hinted tile
        currentInput[i] = lang === 'en' ? (tiles[i] || '').toUpperCase() : (tiles[i] || '');
        grid.setLetter(currentRow, i, currentInput[i]);
      }
      el.classList.remove('show');
      setTimeout(() => el.remove(), 250);
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    // 5s window: long enough to read + tap, short enough not to litter the screen.
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 250);
    }, 5000);
  }

  function showShareBtn() {
    document.getElementById('hintBtn').style.display = 'none';
    document.getElementById('shareBtn').style.display = 'flex';
  }

  /** Show the correct word below the grid after a loss.
   *  Stays visible for the rest of the session so the user always knows
   *  the answer even after dismissing the result sheet. */
  function showAnswerReveal() {
    const el = document.getElementById('answerReveal');
    if (!el) return;
    const letters = puzzle.target.toUpperCase().split('');
    el.innerHTML = `
      <div class="answer-reveal-label">${tx.answer('')}</div>
      <div class="answer-reveal-tiles">
        ${letters.map(l => `<div class="answer-reveal-tile">${l}</div>`).join('')}
      </div>
    `;
    el.style.display = '';
    requestAnimationFrame(() => el.classList.add('answer-reveal-show'));
  }

  let _sharing = false;
  async function share(triggerEl) {
    if (_sharing) return; // guard against double-tap
    _sharing = true;

    // Mark every share button as loading (header + result sheet)
    const allBtns = document.querySelectorAll('#shareBtn, #sheetShareBtn');
    allBtns.forEach(b => b.classList.add('is-sharing'));

    try {
      const text   = renderShareGrid(puzzle, history);
      const result = await shareImage(puzzle, history, text);
      if (result === 'downloaded') showToast(tx.imageSaved);
      else if (result === 'text')  showToast(tx.copied);
    } finally {
      _sharing = false;
      allBtns.forEach(b => b.classList.remove('is-sharing'));
    }
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
      <div class="result-title">${won ? tx.brilliant : tx.lossTitle(puzzle.target.toUpperCase())}</div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-big grad-gold">${streak.current}🔥</div><div class="stat-name">${tx.streak}</div></div>
        <div class="stat-card"><div class="stat-big">${stats.played}</div><div class="stat-name">${tx.played}</div></div>
        <div class="stat-card"><div class="stat-big">${winPct}%</div><div class="stat-name">${tx.winRate}</div></div>
        <div class="stat-card"><div class="stat-big">${streak.max}</div><div class="stat-name">${tx.bestStreak}</div></div>
      </div>
      <div class="result-dist">${distRows}</div>
      <div id="resultRankSlot"></div>
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
          <div class="def-word">${puzzle.target.toUpperCase()}</div>
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


  return {
    onLeave() {
      document.removeEventListener('keydown', onKeydown);
      _dismissSheet?.();
    }
  };
}
