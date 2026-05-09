import { navigate } from '../components/router.js';
import { get } from '../game/gameState.js';
import { t } from '../i18n.js';

export function statsScreen(root) {
  const state = get();
  const lang  = state.settings.lang;
  const tx    = t(lang);
  const stats  = state.stats[lang];
  const streak = state.streak[lang];
  const winPct = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
  const maxDist = Math.max(...stats.dist, 1);

  // Countdown to midnight IST
  const now = Date.now();
  const istNow = now + 19800000;
  const nextMidnightIST = Math.ceil(istNow / 86400000) * 86400000;
  const secsLeft = Math.floor((nextMidnightIST - istNow) / 1000);
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
    <div class="stars" id="stStars"></div>
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="stats-screen">
      <div class="stats-header">
        <button class="stats-back" id="backBtn">←</button>
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
  document.getElementById('shareBtn').addEventListener('click', () => navigate('puzzle', { mode: 'daily' }));

  // Live countdown
  const timer = setInterval(() => {
    const el = document.getElementById('countdown');
    if (!el) { clearInterval(timer); return; }
    const s2 = Math.floor((Math.ceil((Date.now() + 19800000) / 86400000) * 86400000 - (Date.now() + 19800000)) / 1000);
    const h2 = String(Math.floor(s2 / 3600)).padStart(2, '0');
    const m2 = String(Math.floor((s2 % 3600) / 60)).padStart(2, '0');
    const s3 = String(s2 % 60).padStart(2, '0');
    el.textContent = `${h2}:${m2}:${s3}`;
  }, 1000);

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
