import { navigate } from '../components/router.js';
import { get, setSetting } from '../game/gameState.js';
import { t } from '../i18n.js';
import { setupNotifications, scheduleDailyReminder, cancelReminder } from '../notifications.js';

export function settingsScreen(root) {
  const s = get().settings;
  const tx = t(s.lang);

  // Build hour options 6am–11pm IST
  const hourOptions = Array.from({ length: 18 }, (_, i) => {
    const h = i + 6;
    const label = h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`;
    return `<option value="${h}" ${s.notifHour === h ? 'selected' : ''}>${label} IST</option>`;
  }).join('');

  root.innerHTML = `
    <div class="stars" id="stgStars"></div>
    <div class="orb orb-1"></div>
    <div class="settings-screen">
      <div class="stats-header">
        <button class="stats-back" id="backBtn">←</button>
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
            <div class="setting-label">${tx.notifications}</div>
            <div class="setting-sub">${tx.notifSub}</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="notifToggle" ${s.notifications ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div id="notifTimeRow" style="margin-top:12px;${s.notifications ? '' : 'display:none'}">
          <div class="setting-label" style="font-size:12px;margin-bottom:6px;">${tx.notifTime}</div>
          <select id="notifHour" style="width:100%;padding:10px;border-radius:10px;background:var(--card);border:1px solid var(--border);color:var(--text);font-size:14px;font-family:inherit;">
            ${hourOptions}
          </select>
        </div>
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

  document.getElementById('notifToggle').addEventListener('change', async e => {
    const enabled = e.target.checked;
    setSetting('notifications', enabled);
    document.getElementById('notifTimeRow').style.display = enabled ? '' : 'none';
    if (enabled) {
      const granted = await setupNotifications();
      if (granted) {
        await scheduleDailyReminder(get().settings.notifHour);
      } else {
        e.target.checked = false;
        setSetting('notifications', false);
      }
    } else {
      await cancelReminder();
    }
  });

  document.getElementById('notifHour').addEventListener('change', async e => {
    const hour = parseInt(e.target.value, 10);
    setSetting('notifHour', hour);
    if (get().settings.notifications) {
      await scheduleDailyReminder(hour);
    }
  });

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
