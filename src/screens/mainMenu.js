import { navigate } from '../components/router.js';
import { spawnStars } from '../components/ui.js';
import { get, getSession, refreshFreezes, save } from '../game/gameState.js';
import { getISTDate } from '../game/seedEngine.js';
import { MAX_GUESSES } from '../game/wordleMechanic.js';
import { t } from '../i18n.js';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

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
  const todayLost = !todayWon && todaySession.length >= MAX_GUESSES;
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

    <!-- ── Burger drawer overlay ──────────────────────────────────────────── -->
    <div class="drawer-backdrop" id="drawerBackdrop"></div>
    <div class="drawer" id="burgerDrawer" role="dialog" aria-label="Menu">
      <div class="drawer-header">
        <div class="drawer-brand">Shabd</div>
        <button class="drawer-close" id="drawerClose" aria-label="Close menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <nav class="drawer-nav">
        <button class="drawer-item" id="drawerStats">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          <span>${tx.stats}</span>
        </button>
        <button class="drawer-item" id="drawerSettings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M8.46 8.46a5 5 0 0 0 0 7.07"/></svg>
          <span>${tx.settings}</span>
        </button>
        <button class="drawer-item" id="drawerRules">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          <span>${tx.rules}</span>
        </button>
        <div class="drawer-divider"></div>
        <button class="drawer-item" id="drawerInvite">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
          <span>${tx.inviteBtn}</span>
        </button>
      </nav>
      <div class="drawer-footer">${tx.footer(__APP_VERSION__, __VERSION_CODE__)}</div>
    </div>

    <div class="menu-screen">
      <!-- ── Top bar: burger left · lang toggle right ───────────────────── -->
      <div class="menu-topbar">
        <button class="burger-btn" id="btnBurger" aria-label="Open menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="6"  x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div class="lang-toggle" id="langToggle" role="tablist" aria-label="Language">
          <button class="lang-opt ${lang === 'en' ? 'active' : ''}" data-lang="en">EN</button>
          <button class="lang-opt ${lang === 'hi' ? 'active' : ''}" data-lang="hi">हि</button>
        </div>
      </div>

      <div class="menu-hero">
        <div class="title-glyph">${lang === 'hi' ? 'श' : 'W'}</div>
        <div class="menu-title">Shabd</div>
        <div class="menu-tagline">${tx.tagline}</div>

        <button class="streak-card" id="btnStats" aria-label="${tx.stats}">
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
        </button>
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

        <!--
          Practice Mode card removed in vc76. The 'practice' route
          stays registered for one release as a no-op safety net for
          any in-flight share/intent URLs; full removal lands in vc77.
        -->

        <!-- Past Puzzles (was Time Travel) — with sub-label -->
        <button class="btn-secondary btn-with-sub" id="btnArchive">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <div class="btn-text">
            <div class="btn-text-main">${tx.timeTravel}</div>
            <div class="btn-text-sub">${tx.timeTravelSubMenu}</div>
          </div>
        </button>

        <!-- Squads — private leaderboard with friends -->
        <button class="btn-secondary btn-with-sub" id="btnSquads">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <div class="btn-text">
            <div class="btn-text-main">${tx.squadsBtn}</div>
            <div class="btn-text-sub">${tx.squadsBtnSub}</div>
          </div>
        </button>

      </div>

      <!-- footer moved to drawer -->
    </div>
  `;

  spawnStars('menuStars', 60);

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
  root.querySelector('#btnArchive').addEventListener('click', () => navigate('archive'));
  root.querySelector('#btnSquads').addEventListener('click', () => navigate('squads'));
  // Streak card is tappable — opens Stats (agents flagged Stats-in-drawer as too buried)
  root.querySelector('#btnStats').addEventListener('click', () => navigate('stats'));

  // ─── Streak freeze tap → show explanation toast ──────────────────────────
  const freezeChip = root.querySelector('#freezeChip');
  if (freezeChip) {
    freezeChip.addEventListener('click', () => showFreezeToast(tx.freezeTapHint));
  }

  // ─── Burger drawer ───────────────────────────────────────────────────────
  const drawer   = document.getElementById('burgerDrawer');
  const backdrop = document.getElementById('drawerBackdrop');

  function openDrawer() {
    drawer.classList.add('drawer-open');
    backdrop.classList.add('drawer-backdrop-open');
  }
  function closeDrawer() {
    drawer.classList.remove('drawer-open');
    backdrop.classList.remove('drawer-backdrop-open');
  }

  root.querySelector('#btnBurger').addEventListener('click', openDrawer);
  document.getElementById('drawerClose').addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);

  // Drawer nav items — close then navigate
  document.getElementById('drawerStats').addEventListener('click', () => { closeDrawer(); navigate('stats'); });
  document.getElementById('drawerSettings').addEventListener('click', () => { closeDrawer(); navigate('settings'); });
  document.getElementById('drawerRules').addEventListener('click', () => { closeDrawer(); navigate('howToPlay'); });
  document.getElementById('drawerInvite').addEventListener('click', async () => {
    closeDrawer();
    const text = tx.inviteText;

    // Native Android/iOS: use Capacitor Share plugin — opens the full system
    // share sheet with every installed messaging app (WhatsApp, Telegram,
    // Messages, Gmail, etc.).
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({ title: 'Shabd', text, dialogTitle: tx.inviteBtn });
      } catch (_) { /* user cancelled — no-op */ }
      return;
    }

    // Browser: Web Share API (Chrome on Android, Safari on iOS).
    if (navigator.share) {
      try { await navigator.share({ title: 'Shabd', text }); return; }
      catch (_) { /* cancelled or unsupported — fall through */ }
    }

    // Last resort (desktop browsers without Web Share): copy to clipboard.
    try {
      await navigator.clipboard.writeText(text);
      showFreezeToast(tx.copied);
    } catch (_) {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
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

