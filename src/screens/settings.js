import { navigate } from '../components/router.js';
import { get, setSetting } from '../game/gameState.js';

export function settingsScreen(root) {
  const s = get().settings;

  root.innerHTML = `
    <div class="stars" id="stgStars"></div>
    <div class="orb orb-1"></div>
    <div class="settings-screen">
      <div class="stats-header">
        <button class="stats-back" id="backBtn">←</button>
        <div class="stats-title">Settings</div>
      </div>

      <div class="setting-group">
        <div class="setting-label">Language</div>
        <div class="toggle-row">
          <button class="toggle-btn ${s.lang === 'en' ? 'active' : ''}" data-key="lang" data-val="en">English</button>
          <button class="toggle-btn ${s.lang === 'hi' ? 'active' : ''}" data-key="lang" data-val="hi">हिन्दी</button>
        </div>
      </div>

      <div class="setting-group" id="kbGroup" style="${s.lang !== 'hi' ? 'opacity:0.4;pointer-events:none' : ''}">
        <div class="setting-label">Hindi Keyboard</div>
        <div class="toggle-row">
          <button class="toggle-btn ${s.kbMode === 'hinglish' ? 'active' : ''}" data-key="kbMode" data-val="hinglish">Hinglish</button>
          <button class="toggle-btn ${s.kbMode === 'devanagari' ? 'active' : ''}" data-key="kbMode" data-val="devanagari">देवनागरी</button>
        </div>
      </div>

      <div class="setting-group">
        <div class="setting-row">
          <div>
            <div class="setting-label">Sound Effects</div>
            <div class="setting-sub">Tile flip and win sounds</div>
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
            <div class="setting-label">Haptics</div>
            <div class="setting-sub">Vibration feedback on key press</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="hapticToggle" ${s.haptics ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
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
      }
    });
  });

  document.getElementById('soundToggle').addEventListener('change', e => setSetting('sound', e.target.checked));
  document.getElementById('hapticToggle').addEventListener('change', e => setSetting('haptics', e.target.checked));

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
