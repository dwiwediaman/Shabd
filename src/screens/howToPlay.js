import { navigate } from '../components/router.js';
import { get, setFlag } from '../game/gameState.js';
import { t } from '../i18n.js';

export function howToPlayScreen(root, params = {}) {
  const { firstTime = false } = params;
  const lang = get().settings.lang;
  const tx = t(lang);

  root.innerHTML = `
    <div class="stars" id="htpStars"></div>
    <div class="orb orb-1"></div>
    <div class="settings-screen">
      <div class="stats-header">
        ${firstTime
          ? `<div style="width:36px"></div>`
          : `<button class="stats-back" id="backBtn">←</button>`}
        <div class="stats-title">${tx.howToPlayTitle}</div>
        ${firstTime ? `<div style="width:36px"></div>` : ''}
      </div>

      ${firstTime ? `<div class="onboarding-badge">👋 Welcome to Shabd!</div>` : ''}

      <p class="rule-text">${tx.howToPlayIntro}</p>
      <ul class="rule-list">
        <li>${tx.htpRule1}</li>
        <li>${tx.htpRule2}</li>
      </ul>

      <div class="rule-section-title">${tx.htpExamples}</div>

      <div class="rule-example">
        <div class="rule-tile-row">
          <div class="tile tile-correct">${tx.htpEx1Letter}</div>
          <div class="tile tile-absent">·</div>
          <div class="tile tile-absent">·</div>
          <div class="tile tile-absent">·</div>
          <div class="tile tile-absent">·</div>
        </div>
        <p>${tx.htpEx1Text}</p>
      </div>

      <div class="rule-example">
        <div class="rule-tile-row">
          <div class="tile tile-absent">·</div>
          <div class="tile tile-present">${tx.htpEx2Letter}</div>
          <div class="tile tile-absent">·</div>
          <div class="tile tile-absent">·</div>
          <div class="tile tile-absent">·</div>
        </div>
        <p>${tx.htpEx2Text}</p>
      </div>

      <div class="rule-example">
        <div class="rule-tile-row">
          <div class="tile tile-absent">·</div>
          <div class="tile tile-absent">·</div>
          <div class="tile tile-absent">${tx.htpEx3Letter}</div>
          <div class="tile tile-absent">·</div>
          <div class="tile tile-absent">·</div>
        </div>
        <p>${tx.htpEx3Text}</p>
      </div>

      <p class="rule-footer">${tx.htpFooter}</p>

      <button class="btn-primary" id="playBtn" style="margin-top:24px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        ${tx.playNow}
      </button>
    </div>
  `;

  spawnStars('htpStars');

  if (!firstTime) {
    document.getElementById('backBtn').addEventListener('click', () => navigate('menu'));
  }

  document.getElementById('playBtn').addEventListener('click', () => {
    if (firstTime) {
      setFlag('seenTutorial', true);
      navigate('menu');
    } else {
      navigate('puzzle', { mode: 'daily' });
    }
  });

  function spawnStars(id) {
    const el = document.getElementById(id);
    if (!el) return;
    for (let i = 0; i < 40; i++) {
      const s = document.createElement('div');
      s.className = 'star';
      const sz = Math.random() * 2 + 0.5;
      s.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random()*100}%;top:${Math.random()*60}%;animation-delay:${Math.random()*3}s;animation-duration:${2+Math.random()*3}s;`;
      el.appendChild(s);
    }
  }
}
