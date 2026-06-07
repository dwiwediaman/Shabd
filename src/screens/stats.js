import { navigate } from '../components/router.js';
import { get, getSession } from '../game/gameState.js';
import { today as getTodayPuzzle, getISTDate } from '../game/seedEngine.js';
import { shareImage } from '../game/shareImage.js';
import { renderShareGrid } from '../game/wordleMechanic.js';
import { t } from '../i18n.js';

// UTC+5:30 in milliseconds — single source of truth for IST offset in this file
const IST_OFFSET_MS = 19800000;

/** Seconds remaining until the next midnight IST. */
function secsUntilMidnightIST() {
  const istNow = Date.now() + IST_OFFSET_MS;
  return Math.floor((Math.ceil(istNow / 86400000) * 86400000 - istNow) / 1000);
}

export function statsScreen(root) {
  const state = get();
  const lang  = state.settings.lang;
  const tx    = t(lang);
  const stats  = state.stats[lang];
  const streak = state.streak[lang];
  const winPct = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
  const maxDist = Math.max(...stats.dist, 1);

  // Countdown to midnight IST
  const secsLeft = secsUntilMidnightIST();
  const hh = String(Math.floor(secsLeft / 3600)).padStart(2, '0');
  const mm = String(Math.floor((secsLeft % 3600) / 60)).padStart(2, '0');
  const ss = String(secsLeft % 60).padStart(2, '0');

  const distRows = stats.dist.map((count, i) => {
    const pct = Math.round((count / maxDist) * 100);
    const isMax = count === maxDist && count > 0;
    return `
      <div class="dist-row">
        <div class="dist-num">${i + 1}</div>
        <div class="dist-bar-wrap">
          <div class="dist-bar ${isMax ? 'active' : 'inactive'}" style="width:${Math.max(pct, 8)}%">${count}</div>
        </div>
      </div>`;
  }).join('');

  root.innerHTML = `
    <div class="toast" id="toast"></div>
    <div class="stars" id="stStars"></div>
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="stats-screen">
      <div class="stats-header">
        <button class="stats-back" id="backBtn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div class="stats-title">${tx.yourStats}</div>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-big">${stats.played}</div><div class="stat-name">${tx.played}</div></div>
        <div class="stat-card"><div class="stat-big">${winPct}%</div><div class="stat-name">${tx.winRate}</div></div>
        <div class="stat-card"><div class="stat-big grad-gold">${streak.current}🔥</div><div class="stat-name">${tx.streak}</div></div>
        <div class="stat-card"><div class="stat-big">${streak.max}</div><div class="stat-name">${tx.bestStreak}</div></div>
      </div>

      <div class="section-title">${tx.guessDist}</div>
      ${distRows}

      <div style="height:16px"></div>
      <div class="section-title">${tx.nextPuzzle}</div>
      <div class="countdown-card">
        <div class="countdown-time" id="countdown">${hh}:${mm}:${ss}</div>
        <div class="countdown-label">${tx.hoursLeft}</div>
      </div>

      <button class="share-btn" id="shareBtn">${tx.shareResult}</button>
    </div>
  `;

  spawnStars('stStars');
  document.getElementById('backBtn').addEventListener('click', () => navigate('menu'));

  let _sharing = false;
  document.getElementById('shareBtn').addEventListener('click', async () => {
    if (_sharing) return;
    _sharing = true;
    const btn = document.getElementById('shareBtn');
    if (btn) btn.classList.add('is-sharing');
    try {
      const puzzle  = await getTodayPuzzle(lang);
      const history = getSession(`${getISTDate()}|${lang}`);
      if (!history?.length) {
        // Nothing played today — take them to the puzzle instead
        navigate('puzzle', { mode: 'daily' });
        return;
      }
      const text   = renderShareGrid(puzzle, history);
      const result = await shareImage(puzzle, history, text);
      if (result === 'downloaded') showToast(tx.imageSaved);
      else if (result === 'text')  showToast(tx.copied);
    } finally {
      _sharing = false;
      const b = document.getElementById('shareBtn');
      if (b) b.classList.remove('is-sharing');
    }
  });

  // Live countdown
  const timer = setInterval(() => {
    const el = document.getElementById('countdown');
    if (!el) { clearInterval(timer); return; }
    const s2 = secsUntilMidnightIST();
    const h2 = String(Math.floor(s2 / 3600)).padStart(2, '0');
    const m2 = String(Math.floor((s2 % 3600) / 60)).padStart(2, '0');
    const s3 = String(s2 % 60).padStart(2, '0');
    el.textContent = `${h2}:${m2}:${s3}`;
  }, 1000);

  function showToast(msg, duration = 1600) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), duration);
  }

  function spawnStars(id) {
    const el = document.getElementById(id);
    if (!el) return;
    for (let i = 0; i < 50; i++) {
      const s = document.createElement('div');
      s.className = 'star';
      const sz = Math.random() * 2 + 0.5;
      s.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random()*100}%;top:${Math.random()*100}%;animation-delay:${Math.random()*3}s;animation-duration:${2+Math.random()*3}s;`;
      el.appendChild(s);
    }
  }

  return { onLeave() { clearInterval(timer); } };
}
