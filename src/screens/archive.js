import { navigate } from '../components/router.js';
import { get, getSession } from '../game/gameState.js';
import { getISTDate, getPuzzleIndex } from '../game/seedEngine.js';
import { t } from '../i18n.js';

export function archiveScreen(root) {
  const state = get();
  const lang  = state.settings.lang;
  const tx    = t(lang);

  const days = [];
  for (let i = 1; i <= 30; i++) {
    days.push(getISTDate(Date.now() - i * 86400000));
  }

  const rows = days.map(date => {
    const index = getPuzzleIndex(date);
    const session = getSession(`${date}|${lang}`);
    let status = '—';
    let cls = '';
    if (session?.length) {
      const last = session[session.length - 1];
      if (last.isCorrect)          { status = '✓'; cls = 'arch-won'; }
      else if (session.length >= 6){ status = '✗'; cls = 'arch-lost'; }
      else                         { status = '…'; cls = 'arch-partial'; }
    }
    return `
      <div class="arch-row" data-date="${date}">
        <div class="arch-left">
          <div class="arch-label">${tx.archiveDay(index)}</div>
          <div class="arch-date">${date}</div>
        </div>
        <div class="arch-status ${cls}">${status}</div>
        <div class="arch-arrow">›</div>
      </div>`;
  }).join('');

  root.innerHTML = `
    <div class="stars" id="archStars"></div>
    <div class="orb orb-1"></div>
    <div class="archive-screen">
      <div class="stats-header">
        <button class="stats-back" id="backBtn">←</button>
        <div class="stats-title">${tx.archive}</div>
      </div>
      <div class="arch-subtitle">${tx.archiveSubtitle}</div>
      <div class="arch-list">${rows}</div>
    </div>
  `;

  spawnStars('archStars');
  document.getElementById('backBtn').addEventListener('click', () => navigate('menu'));

  root.querySelectorAll('.arch-row').forEach(row => {
    row.addEventListener('click', () => {
      navigate('puzzle', { mode: 'archive', date: row.dataset.date });
    });
  });

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
