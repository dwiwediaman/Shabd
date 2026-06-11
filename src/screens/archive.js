import { navigate } from '../components/router.js';
import { spawnStars } from '../components/ui.js';
import { get, getSession, getSessionMeta } from '../game/gameState.js';
import { getISTDate } from '../game/seedEngine.js';
import { MAX_GUESSES } from '../game/wordleMechanic.js';
import { t } from '../i18n.js';

const LAUNCH_DATE = '2026-01-01';
const DAY_HDRS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
// Floor for month rendering — derived from LAUNCH_DATE so there's one
// place to update if we ever need to show earlier puzzles.
const [LAUNCH_Y, LAUNCH_M_1] = LAUNCH_DATE.split('-').map(Number); // LAUNCH_M_1 is 1-indexed

export function archiveScreen(root) {
  const state    = get();
  const lang     = state.settings.lang;
  const tx       = t(lang);
  const todayStr = getISTDate();
  const [todayY, todayM] = todayStr.split('-').map(Number);

  function ds(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function cellStatus(date) {
    if (date < LAUNCH_DATE || date > todayStr) return 'disabled';
    const session = getSession(`${date}|${lang}`);
    if (!session?.length) return 'unplayed';
    const last = session[session.length - 1];
    if (last.isCorrect)                  return 'won';
    if (session.length >= MAX_GUESSES)   return 'lost';
    return 'partial';
  }

  function buildMonthSection(y, m) {
    const firstDow    = new Date(Date.UTC(y, m, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

    const hdrs   = DAY_HDRS.map(h => `<div class="cal-hdr">${h}</div>`).join('');
    const blanks = Array(firstDow).fill('<div class="cal-blank"></div>').join('');

    const cells = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date    = ds(y, m, d);
      const status  = cellStatus(date);
      const isToday = date === todayStr;
      const session = (status === 'won' || status === 'lost')
        ? getSession(`${date}|${lang}`) : null;
      const sub = session
        ? `<div class="cal-sub">${session.length}/${MAX_GUESSES}</div>` : '';
      const meta = (status !== 'disabled' && status !== 'unplayed')
        ? getSessionMeta(`${date}|${lang}`) : null;
      const dailyDot = meta && !meta.isArchive
        ? '<div class="cal-daily-dot"></div>' : '';

      cells.push(`
        <div class="cal-cell cal-${status}${isToday ? ' cal-today' : ''}"
             data-date="${date}" data-disabled="${status === 'disabled'}">
          <div class="cal-num">${d}</div>${sub}${dailyDot}
        </div>`);
    }

    return `
      <section class="cal-month-section">
        <div class="cal-month-heading">${tx.archiveMonth(m)} ${y}</div>
        <div class="cal-grid">${hdrs}${blanks}${cells.join('')}</div>
      </section>`;
  }

  function buildAllMonths() {
    const sections = [];
    let y = LAUNCH_Y;
    let m = LAUNCH_M_1 - 1; // 0-indexed
    const endY = todayY;
    const endM = todayM - 1; // 0-indexed

    while (y < endY || (y === endY && m <= endM)) {
      sections.push(buildMonthSection(y, m));
      if (m === 11) { m = 0; y++; } else m++;
    }
    return sections.join('');
  }

  root.innerHTML = `
    <div class="stars" id="ttStars"></div>
    <div class="orb orb-1"></div>
    <div class="tt-screen">
      <div class="stats-header">
        <button class="stats-back" id="backBtn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div class="stats-title">${tx.timeTravel}</div>
      </div>
      <div class="tt-sub">${tx.timeTravelSub}</div>
      <div class="cal-legend">
        <span class="leg-item"><span class="leg-dot ld-won"></span>${tx.archiveLegendWon}</span>
        <span class="leg-item"><span class="leg-dot ld-lost"></span>${tx.archiveLegendLost}</span>
        <span class="leg-item"><span class="leg-dot ld-partial"></span>${tx.archiveLegendIncomplete}</span>
        <span class="leg-item"><span class="leg-dot ld-unplayed"></span>${tx.archiveLegendMissed}</span>
      </div>
      <div class="tt-scroll" id="ttScroll">
        ${buildAllMonths()}
      </div>
    </div>`;

  // Cell clicks via delegation
  const ttScroll = document.getElementById('ttScroll');
  ttScroll.addEventListener('click', e => {
    const cell = e.target.closest('.cal-cell');
    if (!cell || cell.dataset.disabled === 'true') return;
    navigate('puzzle', { mode: 'archive', date: cell.dataset.date });
  });

  // Auto-scroll to the latest date that hasn't been completed yet
  // (last unplayed or partial cell), falling back to today's cell.
  const target =
    [...ttScroll.querySelectorAll('.cal-partial, .cal-unplayed')]
      .filter(el => el.dataset.disabled !== 'true')
      .at(-1)
    ?? ttScroll.querySelector('.cal-today');
  if (target) {
    requestAnimationFrame(() =>
      target.scrollIntoView({ block: 'center', behavior: 'instant' })
    );
  }

  document.getElementById('backBtn').addEventListener('click', () => navigate('menu'));

  spawnStars('ttStars', 40);
}
