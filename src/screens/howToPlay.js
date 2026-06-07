import { navigate } from '../components/router.js';
import { spawnStars } from '../components/ui.js';
import { get, setFlag } from '../game/gameState.js';
import { t } from '../i18n.js';

// ─── Demo sequences ─────────────────────────────────────────────────────────
// Each guess: letters[] + states[] (correct | present | absent)
// Word being guessed: DANCE (EN), शब्द-like sequence (HI)
const DEMO_DATA = {
  en: [
    { letters: ['G','R','A','C','E'], states: ['absent','absent','present','correct','correct'] },
    { letters: ['D','A','N','C','E'], states: ['correct','correct','correct','correct','correct'] },
  ],
  hi: [
    { letters: ['ग','र','म','क','ल'], states: ['absent','present','absent','absent','correct'] },
    { letters: ['ह','ल','च','ल','ल'], states: ['present','correct','absent','present','correct'] },
    { letters: ['क','म','ल','ा','ल'], states: ['correct','correct','correct','correct','correct'] },
  ],
};

export function howToPlayScreen(root, params = {}) {
  const { firstTime = false } = params;
  const lang = get().settings.lang;
  const tx   = t(lang);

  // ─── Build demo board HTML ────────────────────────────────────────────────
  const rows = DEMO_DATA[lang] ?? DEMO_DATA.en;
  const demoBoardHtml = rows.map((_, ri) =>
    `<div class="demo-tile-row" id="demoRow${ri}">
      ${Array(5).fill(0).map((__, ci) =>
        `<div class="tile tile-empty demo-tile" id="demoTile${ri}_${ci}"></div>`
      ).join('')}
    </div>`
  ).join('');

  root.innerHTML = `
    <div class="stars" id="htpStars"></div>
    <div class="orb orb-1"></div>
    <div class="htp-screen">

      <div class="stats-header">
        ${firstTime
          ? `<div style="width:44px"></div>`
          : `<button class="stats-back" id="backBtn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>`}
        <div class="stats-title">${tx.howToPlayTitle}</div>
        ${firstTime ? `<div style="width:44px"></div>` : ''}
      </div>

      ${firstTime ? `<div class="onboarding-badge">👋 Welcome to Shabd!</div>` : ''}

      <p class="htp-intro">${tx.howToPlayIntro}</p>

      <!-- ── LIVE DEMO ──────────────────────────────────────────────── -->
      <div class="htp-demo-section">
        <div class="htp-section-label">${tx.htpDemoLabel}</div>
        <div class="htp-demo-board" id="demoBoard">
          ${demoBoardHtml}
        </div>
        <div class="htp-demo-caption">${tx.htpDemoCaption}</div>
      </div>

      <!-- ── STEPS ─────────────────────────────────────────────────── -->
      <div class="htp-section-title">${tx.htpStepsTitle}</div>
      <div class="htp-steps">
        <div class="htp-step">
          <div class="htp-step-num">1</div>
          <div class="htp-step-text">${tx.htpStep1}</div>
        </div>
        <div class="htp-step">
          <div class="htp-step-num">2</div>
          <div class="htp-step-text">${tx.htpStep2}</div>
        </div>
        <div class="htp-step">
          <div class="htp-step-num">3</div>
          <div class="htp-step-text">${tx.htpStep3}</div>
        </div>
        <div class="htp-step">
          <div class="htp-step-num">4</div>
          <div class="htp-step-text">${tx.htpStep4}</div>
        </div>
      </div>

      <!-- ── COLOR GUIDE ───────────────────────────────────────────── -->
      <div class="htp-section-title">${tx.htpColorTitle}</div>

      <div class="htp-color-card htp-color-correct">
        <div class="htp-color-row">
          <div class="tile tile-correct htp-ex-tile">${tx.htpEx1Letter}</div>
          <div class="htp-color-info">
            <div class="htp-color-heading">${tx.htpEx1Heading}</div>
            <div class="htp-color-desc">${tx.htpEx1Text}</div>
          </div>
        </div>
      </div>

      <div class="htp-color-card htp-color-present">
        <div class="htp-color-row">
          <div class="tile tile-present htp-ex-tile">${tx.htpEx2Letter}</div>
          <div class="htp-color-info">
            <div class="htp-color-heading">${tx.htpEx2Heading}</div>
            <div class="htp-color-desc">${tx.htpEx2Text}</div>
          </div>
        </div>
      </div>

      <div class="htp-color-card htp-color-absent">
        <div class="htp-color-row">
          <div class="tile tile-absent htp-ex-tile">${tx.htpEx3Letter}</div>
          <div class="htp-color-info">
            <div class="htp-color-heading">${tx.htpEx3Heading}</div>
            <div class="htp-color-desc">${tx.htpEx3Text}</div>
          </div>
        </div>
      </div>

      <!-- ── KEYBOARD ──────────────────────────────────────────────── -->
      <div class="htp-keyboard-callout">
        <div class="htp-keyboard-title">${tx.htpKeyboardTitle}</div>
        <div class="htp-keyboard-mini">
          <span class="htp-kb-key htp-kb-correct">A</span>
          <span class="htp-kb-key htp-kb-present">E</span>
          <span class="htp-kb-key htp-kb-absent">R</span>
          <span class="htp-kb-key htp-kb-absent">S</span>
          <span class="htp-kb-key htp-kb-correct">T</span>
        </div>
        <div class="htp-keyboard-text">${tx.htpKeyboardText}</div>
      </div>

      <!-- ── SPECIAL FEATURES ──────────────────────────────────────── -->
      <div class="htp-section-title">${tx.htpFeaturesTitle}</div>
      <div class="htp-features">

        <div class="htp-feature-card">
          <div class="htp-feature-title">${tx.htpHardModeTitle}</div>
          <div class="htp-feature-desc">${tx.htpHardModeText}</div>
        </div>

        <div class="htp-feature-card">
          <div class="htp-feature-title">${tx.htpHintsTitle}</div>
          <div class="htp-feature-desc">${tx.htpHintsText}</div>
        </div>

        <div class="htp-feature-card">
          <div class="htp-feature-title">${tx.htpArchiveTitle}</div>
          <div class="htp-feature-desc">${tx.htpArchiveText}</div>
        </div>

      </div>

      <!-- ── TIPS ──────────────────────────────────────────────────── -->
      <div class="htp-section-title">${tx.htpTipsTitle}</div>
      <div class="htp-tips">
        <div class="htp-tip">💡 ${tx.htpTip1}</div>
        <div class="htp-tip">💡 ${tx.htpTip2}</div>
        <div class="htp-tip">💡 ${tx.htpTip3}</div>
      </div>

      <button class="btn-primary" id="playBtn" style="margin-top:28px;margin-bottom:8px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        ${tx.playNow}
      </button>

    </div>`;

  // ─── Stars ────────────────────────────────────────────────────────────────
  spawnStars('htpStars', 40);

  // ─── Nav ─────────────────────────────────────────────────────────────────
  if (!firstTime) {
    document.getElementById('backBtn').addEventListener('click', () => navigate('menu'));
  }
  document.getElementById('playBtn').addEventListener('click', () => {
    stopDemo();
    if (firstTime) { setFlag('seenTutorial', true); navigate('menu'); }
    else            { navigate('puzzle', { mode: 'daily' }); }
  });

  // ─── Animated Demo ───────────────────────────────────────────────────────
  let demoTimer = null;
  let demoRunning = true;

  function stopDemo() {
    demoRunning = false;
    clearTimeout(demoTimer);
  }

  function getTile(ri, ci) {
    return document.getElementById(`demoTile${ri}_${ci}`);
  }

  function resetBoard() {
    rows.forEach((_, ri) =>
      [0,1,2,3,4].forEach(ci => {
        const t = getTile(ri, ci);
        if (t) { t.className = 'tile tile-empty demo-tile'; t.textContent = ''; t.style.cssText = ''; }
      })
    );
  }

  function typeLetter(ri, ci, letter, cb) {
    if (!demoRunning) return;
    const tile = getTile(ri, ci);
    if (!tile) return;
    tile.textContent = letter;
    tile.className = 'tile tile-active demo-tile';
    // pop effect
    tile.style.transform = 'scale(1.12)';
    tile.style.transition = 'transform 0.1s ease';
    demoTimer = setTimeout(() => {
      tile.style.transform = 'scale(1)';
      if (cb) demoTimer = setTimeout(cb, 80);
    }, 100);
  }

  function flipTile(ri, ci, state, cb) {
    if (!demoRunning) return;
    const tile = getTile(ri, ci);
    if (!tile) return;
    // Fold down
    tile.style.transition = 'transform 0.15s ease';
    tile.style.transform = 'scaleY(0)';
    demoTimer = setTimeout(() => {
      tile.className = `tile tile-${state} demo-tile`;
      tile.style.transform = 'scaleY(1)';
      demoTimer = setTimeout(() => {
        tile.style.transition = '';
        tile.style.transform = '';
        if (cb) cb();
      }, 160);
    }, 150);
  }

  function typeRow(ri, doneCallback) {
    const guess = rows[ri];
    let ci = 0;
    function next() {
      if (!demoRunning) return;
      if (ci >= guess.letters.length) { demoTimer = setTimeout(doneCallback, 350); return; }
      typeLetter(ri, ci, guess.letters[ci], () => { ci++; demoTimer = setTimeout(next, 120); });
    }
    next();
  }

  function flipRow(ri, doneCallback) {
    const guess = rows[ri];
    let ci = 0;
    function next() {
      if (!demoRunning) return;
      if (ci >= guess.states.length) {
        const isWin = guess.states.every(s => s === 'correct');
        demoTimer = setTimeout(doneCallback, isWin ? 900 : 400);
        return;
      }
      flipTile(ri, ci, guess.states[ci], () => { ci++; demoTimer = setTimeout(next, 60); });
    }
    next();
  }

  function runGuess(ri, doneCallback) {
    if (!demoRunning) return;
    typeRow(ri, () => flipRow(ri, doneCallback));
  }

  function startDemo() {
    if (!demoRunning) return;
    resetBoard();
    let ri = 0;
    function nextGuess() {
      if (!demoRunning) return;
      if (ri >= rows.length) {
        // loop after pause
        demoTimer = setTimeout(startDemo, 2200);
        return;
      }
      runGuess(ri, () => { ri++; demoTimer = setTimeout(nextGuess, 200); });
    }
    demoTimer = setTimeout(nextGuess, 600);
  }

  startDemo();

  // ─── Stars helper ────────────────────────────────────────────────────────
}
