import { navigate } from '../components/router.js';
import { get, getSession, refreshFreezes, save } from '../game/gameState.js';
import { getISTDate } from '../game/seedEngine.js';
import { t } from '../i18n.js';

export function mainMenuScreen(root) {
  const state = get();
  const lang = state.settings.lang;
  const tx = t(lang);
  const streak = state.streak[lang];
  const stats  = state.stats[lang];
  const winPct = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;

  const todayIST = getISTDate();
  refreshFreezes(lang, todayIST);
  const freeze = get().freezes[lang];

  // ─── Determine today's play state ─────────────────────────────────────────
  const todaySession = getSession(`${todayIST}|${lang}`) || [];
  const lastGuess = todaySession[todaySession.length - 1];
  const todayWon  = !!(lastGuess && lastGuess.isCorrect);
  const todayLost = !todayWon && todaySession.length >= 6;
  const todayDone = todayWon || todayLost;
  const todayInProgress = todaySession.length > 0 && !todayDone;

  let playLabel, playBadge, playClass;
  if (todayWon) {
    playLabel = tx.playDone;       playBadge = tx.badgeDone;     playClass = 'btn-played-won';
  } else if (todayLost) {
    playLabel = tx.playDone;       playBadge = tx.badgeFailed;   playClass = 'btn-played-lost';
  } else if (todayInProgress) {
    playLabel = tx.playContinue;   playBadge = tx.badgeActive;   playClass = 'btn-played-active';
  } else {
    playLabel = tx.playToday;      playBadge = tx.badgeNew;      playClass = '';
  }

  root.innerHTML = `
    <div class="stars" id="menuStars"></div>
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>

    <div class="menu-screen">
      <!-- ── Top bar: prominent language toggle ─────────────────────────── -->
      <div class="menu-topbar">
        <div class="lang-toggle" id="langToggle" role="tablist" aria-label="Language">
          <button class="lang-opt ${lang === 'en' ? 'active' : ''}" data-lang="en">EN</button>
          <button class="lang-opt ${lang === 'hi' ? 'active' : ''}" data-lang="hi">हि</button>
        </div>
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
        ${freeze.count > 0
          ? `<button class="freeze-chip" id="freezeChip" aria-label="streak freeze info">${tx.streakFreezeAvail} <span class="freeze-info-icon">ⓘ</span></button>`
          : ''}
      </div>

      <div class="menu-actions">
        <!-- Primary CTA — adapts to today's state -->
        <button class="btn-primary ${playClass}" id="btnPlay">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          ${playLabel}
          <span class="btn-badge">${playBadge}</span>
        </button>

        <!-- Practice — with sub-label -->
        <button class="btn-secondary btn-with-sub" id="btnPractice">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <div class="btn-text">
            <div class="btn-text-main">${tx.practiceMode}</div>
            <div class="btn-text-sub">${tx.practiceSub}</div>
          </div>
        </button>

        <!-- Past Puzzles (was Time Travel) — with sub-label -->
        <button class="btn-secondary btn-with-sub" id="btnArchive">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <div class="btn-text">
            <div class="btn-text-main">${tx.timeTravel}</div>
            <div class="btn-text-sub">${tx.timeTravelSubMenu}</div>
          </div>
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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            <span>${tx.rules}</span>
          </button>
        </div>

        <!-- Invite — restyled to match app theme -->
        <button class="btn-invite-themed" id="btnInvite">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
          ${tx.inviteBtn}
        </button>
      </div>

      <div class="menu-footer">${tx.footer(__APP_VERSION__, __VERSION_CODE__)}</div>
    </div>
  `;

  spawnStars('menuStars');

  // ─── Language toggle ─────────────────────────────────────────────────────
  root.querySelectorAll('.lang-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const newLang = btn.dataset.lang;
      if (newLang === lang) return;
      const s = get();
      s.settings.lang = newLang;
      save();
      navigate('menu');
    });
  });

  // ─── Primary actions ─────────────────────────────────────────────────────
  root.querySelector('#btnPlay').addEventListener('click', () => navigate('puzzle', { mode: 'daily' }));
  root.querySelector('#btnPractice').addEventListener('click', () => navigate('puzzle', { mode: 'practice' }));
  root.querySelector('#btnArchive').addEventListener('click', () => navigate('archive'));
  root.querySelector('#btnStats').addEventListener('click', () => navigate('stats'));
  root.querySelector('#btnSettings').addEventListener('click', () => navigate('settings'));
  root.querySelector('#btnRules').addEventListener('click', () => navigate('howToPlay'));

  // ─── Streak freeze tap → show explanation toast ──────────────────────────
  const freezeChip = root.querySelector('#freezeChip');
  if (freezeChip) {
    freezeChip.addEventListener('click', () => showFreezeToast(tx.freezeTapHint));
  }

  // ─── Invite ─────────────────────────────────────────────────────────────
  root.querySelector('#btnInvite').addEventListener('click', async () => {
    const text = tx.inviteText;
    if (navigator.share) {
      try { await navigator.share({ text }); return; }
      catch (_) { /* cancelled or unsupported — fall through */ }
    }
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  });
}

function showFreezeToast(msg) {
  // Remove any existing toast
  document.querySelector('.menu-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'menu-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 250);
  }, 3500);
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
