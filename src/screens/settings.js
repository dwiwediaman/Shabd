import { navigate } from '../components/router.js';
import { get, setSetting, getSession } from '../game/gameState.js';
import { t } from '../i18n.js';
import { getISTDate } from '../game/seedEngine.js';
import { setupNotifications, scheduleDailyReminder, cancelReminder } from '../notifications.js';
import { Capacitor } from '@capacitor/core';
import { isSignedIn, getCurrentUser, signIn, signOut, deleteCloudAccount } from '../cloud/auth.js';
import { pullAndMerge, pushAll, syncAfterSignIn } from '../cloud/sync.js';
import { LS_KEYS } from '../cloud/config.js';

export function settingsScreen(root) {
  const s = get().settings;
  const tx = t(s.lang);

  // Hard mode can only be toggled before the daily game starts
  const todayStr = getISTDate();
  const todaySession = getSession(`${todayStr}|${s.lang}`);
  const hardModeLocked = !!(todaySession && todaySession.length > 0);

  root.innerHTML = `
    <div class="stars" id="stgStars"></div>
    <div class="orb orb-1"></div>
    <div class="settings-screen">
      <div class="stats-header">
        <button class="stats-back" id="backBtn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div class="stats-title">${tx.settingsTitle}</div>
      </div>

      <div class="setting-group">
        <div class="setting-label">${tx.language}</div>
        <div class="toggle-row">
          <button class="toggle-btn ${s.lang === 'en' ? 'active' : ''}" data-key="lang" data-val="en">English</button>
          <button class="toggle-btn ${s.lang === 'hi' ? 'active' : ''}" data-key="lang" data-val="hi">हिन्दी</button>
        </div>
      </div>

      <div class="setting-group" id="kbGroup" style="${s.lang !== 'hi' ? 'opacity:0.4;pointer-events:none' : ''}">
        <div class="setting-label">${tx.hindiKb}</div>
        <div class="toggle-row">
          <button class="toggle-btn ${s.kbMode === 'hinglish' ? 'active' : ''}" data-key="kbMode" data-val="hinglish">Hinglish</button>
          <button class="toggle-btn ${s.kbMode === 'devanagari' ? 'active' : ''}" data-key="kbMode" data-val="devanagari">देवनागरी</button>
        </div>
      </div>

      <div class="setting-group">
        <div class="setting-row">
          <div>
            <div class="setting-label">${tx.soundEffects}</div>
            <div class="setting-sub">${tx.soundSub}</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="soundToggle" ${s.sound ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="setting-group">
        <div class="setting-row">
          <div>
            <div class="setting-label">${tx.haptics}</div>
            <div class="setting-sub">${tx.hapticsSub}</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="hapticToggle" ${s.haptics ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="setting-group">
        <div class="setting-row">
          <div>
            <div class="setting-label">${tx.hardMode}</div>
            <div class="setting-sub">${hardModeLocked ? '🔒 Complete today\'s puzzle to change' : tx.hardModeSub}</div>
          </div>
          <label class="switch" style="${hardModeLocked ? 'opacity:0.45;pointer-events:none' : ''}">
            <input type="checkbox" id="hardModeToggle" ${s.hardMode ? 'checked' : ''} ${hardModeLocked ? 'disabled' : ''}>
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="setting-group">
        <div class="setting-row">
          <div>
            <div class="setting-label">${tx.notifications}</div>
            <div class="setting-sub">${tx.notifSub}</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="notifToggle" ${s.notifications ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div id="notifTimeRow" style="margin-top:8px;${s.notifications ? '' : 'display:none'}">
          <div class="setting-sub" style="font-size:11px;line-height:1.4;">
            ${tx.notifFixedSlots}
          </div>
        </div>
      </div>

      ${cloudSectionHtml(tx)}

      <div class="setting-group">
        <button class="setting-row setting-link" id="feedbackBtn" style="width:100%;background:none;border:none;cursor:pointer;text-align:left;padding:0;">
          <div>
            <div class="setting-label">${tx.feedbackTitle}</div>
            <div class="setting-sub">${tx.feedbackSub}</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5;flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  `;

  spawnStars('stgStars');
  document.getElementById('backBtn').addEventListener('click', () => navigate('menu'));

  root.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const val = btn.dataset.val;
      setSetting(key, val);
      root.querySelectorAll(`[data-key="${key}"]`).forEach(b => b.classList.toggle('active', b === btn));
      if (key === 'lang') {
        const kbGroup = document.getElementById('kbGroup');
        kbGroup.style.opacity = val === 'hi' ? '1' : '0.4';
        kbGroup.style.pointerEvents = val === 'hi' ? '' : 'none';
        navigate('settings');
      }
    });
  });

  document.getElementById('soundToggle').addEventListener('change', e => setSetting('sound', e.target.checked));
  document.getElementById('hapticToggle').addEventListener('change', e => setSetting('haptics', e.target.checked));
  document.getElementById('hardModeToggle').addEventListener('change', e => setSetting('hardMode', e.target.checked));
  document.getElementById('feedbackBtn').addEventListener('click', () => {
    const url = 'https://play.google.com/store/apps/details?id=in.shabd.game';
    window.open(url, '_system');
  });

  document.getElementById('notifToggle').addEventListener('change', async e => {
    const enabled = e.target.checked;
    setSetting('notifications', enabled);
    document.getElementById('notifTimeRow').style.display = enabled ? '' : 'none';
    if (enabled) {
      const granted = await setupNotifications();
      if (granted) {
        await scheduleDailyReminder();
      } else {
        e.target.checked = false;
        setSetting('notifications', false);
      }
    } else {
      await cancelReminder();
    }
  });

  // notifHour picker removed in vc95 — three slots (9am / 2pm / 8pm IST)
  // are now fixed. The legacy notifHour value in state is ignored.

  // ── Cloud backup wiring ────────────────────────────────────────────────
  wireCloudSection(tx);

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
}

// ── Cloud Backup section ──────────────────────────────────────────────────
function cloudSectionHtml(tx) {
  // On web, the social-login plugin can't sign in — hide the section entirely.
  if (!Capacitor.isNativePlatform()) return '';

  const signedIn = isSignedIn();
  const user     = getCurrentUser();
  const lastSync = readLastSync();

  return `
    <div class="setting-group" id="cloudGroup">
      <div class="setting-row" style="align-items:flex-start;">
        <div style="flex:1;min-width:0;">
          <div class="setting-label">${tx.cloudBackupTitle}</div>
          <div class="setting-sub">${signedIn && user ? tx.cloudSignedInAs(escapeHtml(user.nickname)) : tx.cloudBackupSub}</div>
        </div>
      </div>

      ${signedIn ? `
        <div id="cloudSyncStatus" class="setting-sub" style="margin-top:4px;font-size:11px;opacity:.65;">
          ${lastSync ? tx.cloudSyncedAgo(formatAgo(lastSync, tx)) : tx.cloudNeverSynced}
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
          <button class="btn-cloud" id="cloudSyncBtn">${tx.cloudSyncNow}</button>
          <button class="btn-cloud btn-cloud-secondary" id="cloudSignOutBtn">${tx.cloudSignOut}</button>
          <button class="btn-cloud btn-cloud-danger" id="cloudDeleteBtn">${tx.cloudDelete}</button>
        </div>
      ` : `
        <button class="btn-google-signin" id="cloudSignInBtn" style="margin-top:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21.35 11.1H12v3.84h5.36c-.23 1.23-.93 2.27-1.98 2.97v2.46h3.21c1.88-1.74 2.96-4.3 2.96-7.34 0-.6-.06-1.17-.2-1.93z" fill="#4285F4"/>
            <path d="M12 22c2.7 0 4.96-.9 6.61-2.43l-3.21-2.46c-.9.6-2.04.96-3.4.96-2.61 0-4.82-1.76-5.6-4.13H3.07v2.6C4.72 19.7 8.1 22 12 22z" fill="#34A853"/>
            <path d="M6.4 13.94a6 6 0 010-3.88v-2.6H3.07a10 10 0 000 9.08l3.33-2.6z" fill="#FBBC05"/>
            <path d="M12 6c1.47 0 2.78.5 3.82 1.5l2.86-2.86C16.96 3.05 14.7 2 12 2 8.1 2 4.72 4.3 3.07 7.46l3.33 2.6C7.18 7.76 9.39 6 12 6z" fill="#EA4335"/>
          </svg>
          <span>${tx.cloudSignIn}</span>
        </button>
      `}
    </div>
  `;
}

function wireCloudSection(tx) {
  if (!Capacitor.isNativePlatform()) return;

  const signInBtn  = document.getElementById('cloudSignInBtn');
  const syncBtn    = document.getElementById('cloudSyncBtn');
  const signOutBtn = document.getElementById('cloudSignOutBtn');
  const deleteBtn  = document.getElementById('cloudDeleteBtn');

  if (signInBtn) {
    signInBtn.addEventListener('click', async () => {
      signInBtn.disabled = true;
      signInBtn.innerHTML = `<span>${tx.cloudSyncing}</span>`;
      try {
        await signIn();
        await syncAfterSignIn();  // push local history, then pull anything the server already has
        navigate('settings');
      } catch (e) {
        console.warn('[cloud] sign-in failed:', e);
        const msg = e?.message || '';
        if (msg !== 'cancelled') {
          showSettingsToast(tx.cloudSignInError + ' (' + (msg || 'unknown') + ')');
        }
        signInBtn.disabled = false;
        navigate('settings');
      }
    });
  }

  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      syncBtn.disabled = true;
      const original = syncBtn.textContent;
      syncBtn.textContent = tx.cloudSyncing;
      try {
        await pushAll();
        await pullAndMerge();
        const status = document.getElementById('cloudSyncStatus');
        if (status) status.textContent = tx.cloudSyncedAgo(tx.cloudJustNow);
      } catch {
        showSettingsToast(tx.cloudNetworkError);
      } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = original;
      }
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      await signOut();
      navigate('settings');
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(tx.cloudDeleteConfirm)) return;
      try {
        await deleteCloudAccount();
        navigate('settings');
      } catch {
        showSettingsToast(tx.cloudNetworkError);
      }
    });
  }
}

function readLastSync() {
  try {
    const v = localStorage.getItem(LS_KEYS.lastSyncAt);
    return v ? Number(v) : null;
  } catch { return null; }
}

function formatAgo(ts, tx) {
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return tx.cloudJustNow;
  if (min < 60) return tx.cloudMinutesAgo(min);
  const hr = Math.floor(min / 60);
  if (hr < 24) return tx.cloudHoursAgo(hr);
  const day = Math.floor(hr / 24);
  return tx.cloudDaysAgo(day);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function showSettingsToast(msg) {
  const existing = document.querySelector('.settings-toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'settings-toast menu-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 3000);
}
