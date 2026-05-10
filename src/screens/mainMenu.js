import { navigate } from '../components/router.js';
import { get, refreshFreezes } from '../game/gameState.js';
import { t } from '../i18n.js';

export function mainMenuScreen(root) {
  const state = get();
  const lang = state.settings.lang;
  const tx = t(lang);
  const streak = state.streak[lang];
  const stats  = state.stats[lang];
  const winPct = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;

  const todayIST = new Date(Date.now() + 19800000).toISOString().slice(0, 10);
  refreshFreezes(lang, todayIST);
  const freeze = get().freezes[lang];

  root.innerHTML = `
    <div class="stars" id="menuStars"></div>
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>

    <div class="menu-screen">
      <div class="menu-topbar">
        <button class="lang-pill" id="langToggle">${lang === 'en' ? 'EN ⇌ हि' : 'हि ⇌ EN'}</button>
      </div>

      <div class="menu-hero">
        <div class="title-glyph">${lang === 'hi' ? 'श' : 'W'}</div>
        <div class="menu-title">Shabd</div>
        <div class="menu-tagline">${tx.tagline}</div>

        <div class="streak-card">
          <div class="streak-item">
            <div class="streak-num">${streak.current}🔥</div>
            <div class="streak-lbl">${tx.streak}</div>
          </div>
          <div class="streak-divider"></div>
          <div class="streak-item">
            <div class="streak-num">${stats.played}</div>
            <div class="streak-lbl">${tx.played}</div>
          </div>
          <div class="streak-divider"></div>
          <div class="streak-item">
            <div class="streak-num">${winPct}%</div>
            <div class="streak-lbl">${tx.winRate}</div>
          </div>
        </div>
        ${freeze.count > 0 ? `<div class="freeze-indicator">${tx.streakFreezeAvail}</div>` : ''}
      </div>

      <div class="menu-actions">
        <button class="btn-primary" id="btnPlay">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          ${tx.playToday}
          <span class="btn-badge">${tx.badgeNew}</span>
        </button>

        <button class="btn-secondary" id="btnPractice">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          ${tx.practiceMode}
        </button>

        <button class="btn-secondary" id="btnArchive">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${tx.timeTravel}
        </button>

        <button class="btn-invite" id="btnInvite">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          ${tx.inviteBtn}
        </button>

        <div class="btn-row">
          <button class="btn-secondary btn-icon-stack" id="btnStats">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            <span>${tx.stats}</span>
          </button>
          <button class="btn-secondary btn-icon-stack" id="btnSettings">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M8.46 8.46a5 5 0 0 0 0 7.07"/></svg>
            <span>${tx.settings}</span>
          </button>
          <button class="btn-secondary btn-icon-stack" id="btnRules">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <span>${tx.rules}</span>
          </button>
        </div>
      </div>

      <div class="menu-footer">${tx.footer}</div>
    </div>
  `;

  spawnStars('menuStars');

  root.querySelector('#langToggle').addEventListener('click', () => {
    const s = get();
    s.settings.lang = s.settings.lang === 'en' ? 'hi' : 'en';
    import('../game/gameState.js').then(m => m.save());
    navigate('menu');
  });

  root.querySelector('#btnPlay').addEventListener('click', () => navigate('puzzle', { mode: 'daily' }));
  root.querySelector('#btnPractice').addEventListener('click', () => navigate('puzzle', { mode: 'practice' }));
  root.querySelector('#btnArchive').addEventListener('click', () => navigate('archive'));
  root.querySelector('#btnStats').addEventListener('click', () => navigate('stats'));
  root.querySelector('#btnSettings').addEventListener('click', () => navigate('settings'));
  root.querySelector('#btnRules').addEventListener('click', () => navigate('howToPlay'));

  root.querySelector('#btnInvite').addEventListener('click', async () => {
    const text = tx.inviteText;
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (_) { /* cancelled or unsupported — fall through */ }
    }
    // Fallback: open WhatsApp with pre-filled message
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  });
}

function spawnStars(id) {
  const el = document.getElementById(id);
  if (!el) return;
  for (let i = 0; i < 60; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const size = Math.random() * 2 + 0.5;
    s.style.cssText = `width:${size}px;height:${size}px;left:${Math.random()*100}%;top:${Math.random()*100}%;animation-delay:${Math.random()*3}s;animation-duration:${2+Math.random()*3}s;`;
    el.appendChild(s);
  }
}
