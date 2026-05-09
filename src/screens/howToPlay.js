import { navigate } from '../components/router.js';

export function howToPlayScreen(root) {
  root.innerHTML = `
    <div class="stars" id="htpStars"></div>
    <div class="orb orb-1"></div>
    <div class="settings-screen">
      <div class="stats-header">
        <button class="stats-back" id="backBtn">←</button>
        <div class="stats-title">How to Play</div>
      </div>

      <p class="rule-text">Guess the <strong>Shabd</strong> in 6 tries.</p>
      <ul class="rule-list">
        <li>Each guess must be a valid word.</li>
        <li>The color of the tiles will change to show how close your guess was.</li>
      </ul>

      <div class="rule-section-title">Examples</div>

      <div class="rule-example">
        <div class="rule-tile-row">
          <div class="tile tile-correct">W</div>
          <div class="tile tile-absent">E</div>
          <div class="tile tile-absent">A</div>
          <div class="tile tile-absent">R</div>
          <div class="tile tile-absent">Y</div>
        </div>
        <p><strong>W</strong> is in the word and in the correct spot.</p>
      </div>

      <div class="rule-example">
        <div class="rule-tile-row">
          <div class="tile tile-absent">P</div>
          <div class="tile tile-present">I</div>
          <div class="tile tile-absent">L</div>
          <div class="tile tile-absent">L</div>
          <div class="tile tile-absent">S</div>
        </div>
        <p><strong>I</strong> is in the word but in the wrong spot.</p>
      </div>

      <div class="rule-example">
        <div class="rule-tile-row">
          <div class="tile tile-absent">V</div>
          <div class="tile tile-absent">A</div>
          <div class="tile tile-absent">G</div>
          <div class="tile tile-absent">U</div>
          <div class="tile tile-absent">E</div>
        </div>
        <p><strong>U</strong> is not in the word in any spot.</p>
      </div>

      <p class="rule-footer">A new word is available each day at midnight IST.</p>

      <button class="btn-primary" id="playBtn" style="margin-top:24px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Play Now
      </button>
    </div>
  `;

  spawnStars('htpStars');
  document.getElementById('backBtn').addEventListener('click', () => navigate('menu'));
  document.getElementById('playBtn').addEventListener('click', () => navigate('puzzle', { mode: 'daily' }));

  function spawnStars(id) {
    const el = document.getElementById(id);
    if (!el) return;
    for (let i = 0; i < 40; i++) {
      const s = document.createElement('div');
      s.className = 'star';
      const sz = Math.random() * 2 + 0.5;
      s.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random()*100}%;top:${Math.random()*100}%;animation-delay:${Math.random()*3}s;animation-duration:${2+Math.random()*3}s;`;
      el.appendChild(s);
    }
  }
}
