// ── In-app update check (Android only) ────────────────────────────────────
// Uses Google Play Core In-App Update API via @capawesome/capacitor-app-update.
//
// Flow:
//   1. On app boot → getAppUpdateInfo()
//   2. If update available AND flexible allowed → show banner
//   3. User taps "Update" → startFlexibleUpdate() (downloads in background)
//   4. Listener tracks download → when DOWNLOADED (11), swap banner to "Restart"
//   5. User taps "Restart" → completeFlexibleUpdate() restarts the app
//
// Web / iOS: silently no-op.

import { Capacitor } from '@capacitor/core';
import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update';

const SESSION_DISMISS_KEY = 'shabd_update_dismissed_session';
const INSTALL_STATUS_DOWNLOADED = 11;

let _bannerEl = null;
let _listener = null;
let _state = 'idle'; // 'idle' | 'available' | 'downloading' | 'ready'

export async function checkForUpdate() {
  // Native only
  if (!Capacitor.isNativePlatform()) return;

  // Skip if user dismissed this session
  if (sessionStorage.getItem(SESSION_DISMISS_KEY) === '1') return;

  try {
    const info = await AppUpdate.getAppUpdateInfo();
    if (info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) return;
    if (!info.flexibleUpdateAllowed) return;

    // Show banner
    _state = 'available';
    showBanner({
      icon: '🆕',
      title: 'New version available',
      sub:   `v${info.availableVersionCode ?? '?'} is ready to install`,
      btn:   'Update',
      onBtn: () => startUpdate(),
    });
  } catch (e) {
    console.warn('[updateCheck] failed:', e);
  }
}

async function startUpdate() {
  try {
    _state = 'downloading';
    showBanner({
      icon: '⬇',
      title: 'Downloading update…',
      sub:   'You can keep playing while it downloads',
      progress: true,
    });

    // Subscribe to state changes — when DOWNLOADED, prompt to restart
    if (_listener) { _listener.remove?.(); _listener = null; }
    _listener = await AppUpdate.addListener('onFlexibleUpdateStateChange', (state) => {
      if (state?.installStatus === INSTALL_STATUS_DOWNLOADED) {
        _state = 'ready';
        showBanner({
          icon: '✓',
          title: 'Update ready',
          sub:   'Restart Shabd to apply the new version',
          btn:   'Restart',
          onBtn: () => completeUpdate(),
        });
      }
    });

    await AppUpdate.startFlexibleUpdate();
  } catch (e) {
    console.warn('[updateCheck] startFlexibleUpdate failed:', e);
    hideBanner();
  }
}

async function completeUpdate() {
  try { await AppUpdate.completeFlexibleUpdate(); }
  catch (e) { console.warn('[updateCheck] complete failed:', e); }
}

// ── Banner UI ─────────────────────────────────────────────────────────────
function showBanner({ icon, title, sub, btn, onBtn, progress }) {
  hideBanner();

  const el = document.createElement('div');
  el.id = 'updateBanner';
  el.className = 'update-banner';
  el.innerHTML = `
    <div class="update-banner-icon">${icon}</div>
    <div class="update-banner-text">
      <div class="update-banner-title">${title}</div>
      <div class="update-banner-sub">${sub}</div>
      ${progress ? '<div class="update-banner-progress"><div class="update-banner-progress-bar"></div></div>' : ''}
    </div>
    ${btn ? `<button class="update-banner-btn" id="updBtn">${btn}</button>` : ''}
    ${!progress ? '<button class="update-banner-close" id="updClose" aria-label="dismiss">✕</button>' : ''}
  `;
  document.body.appendChild(el);
  // Trigger slide-in
  requestAnimationFrame(() => el.classList.add('show'));

  if (btn && onBtn) {
    el.querySelector('#updBtn').addEventListener('click', onBtn);
  }
  if (!progress) {
    el.querySelector('#updClose')?.addEventListener('click', () => {
      sessionStorage.setItem(SESSION_DISMISS_KEY, '1');
      hideBanner();
    });
  }

  _bannerEl = el;
}

function hideBanner() {
  if (_bannerEl) {
    _bannerEl.classList.remove('show');
    const el = _bannerEl;
    setTimeout(() => el.remove(), 300);
    _bannerEl = null;
  }
}
