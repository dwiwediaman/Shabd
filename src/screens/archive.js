import { navigate } from '../components/router.js';
import { get, getSession } from '../game/gameState.js';
import { getISTDate } from '../game/seedEngine.js';
import { t } from '../i18n.js';

const LAUNCH_DATE = '2026-01-01';
const DAY_HDRS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const MONTHS   = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

export function archiveScreen(root) {
  const state   = get();
  const lang    = state.settings.lang;
  const tx      = t(lang);
  const todayStr = getISTDate();
  const [todayY, todayM] = todayStr.split('-').map(Number);

  let viewYear  = todayY;
  let viewMonth = todayM - 1; // 0-indexed

  function ds(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function cellStatus(date) {
    if (date < LAUNCH_DATE || date > todayStr) return 'disabled';
    const session = getSession(`${date}|${lang}`);
    if (!session?.length) return 'unplayed';
    const last = session[session.length - 1];
    if (last.isCorrect)    return 'won';
    if (session.length >= 6) return 'lost';
    return 'partial';
  }

  function buildCal() {
    const firstDow    = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const canPrev = !(viewYear === 2026 && viewMonth === 0);
    const canNext = !(viewYear === todayY && viewMonth === todayM - 1);

    const hdrs   = DAY_HDRS.map(h => `<div class="cal-hdr">${h}</div>`).join('');
    const blanks = Array(firstDow).fill('<div class="cal-blank"></div>').join('');

    const cells = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date   = ds(viewYear, viewMonth, d);
      const status = cellStatus(date);
      const isToday = date === todayStr;
      const session = (status === 'won' || status === 'lost')
        ? getSession(`${date}|${lang}`) : null;
      const sub = session
        ? `<div class="cal-sub">${session.length}/6</div>` : '';

      cells.push(`
        <div class="cal-cell cal-${status}${isToday ? ' cal-today' : ''}"
             data-date="${date}" data-disabled="${status === 'disabled'}">
          <div class="cal-num">${d}</div>${sub}
        </div>`);
    }

    return `
      <div class="cal-nav">
        <button class="cal-nav-btn" id="calPrev" ${canPrev ? '' : 'disabled'}>‹</button>
        <div class="cal-month">${MONTHS[viewMonth]} ${viewYear}</div>
        <button class="cal-nav-btn" id="calNext" ${canNext ? '' : 'disabled'}>›</button>
      </div>
      <div class="cal-legend">
        <span class="leg-item"><span class="leg-dot ld-won"></span>Won</span>
        <span class="leg-item"><span class="leg-dot ld-lost"></span>Lost</span>
        <span class="leg-item"><span class="leg-dot ld-partial"></span>Incomplete</span>
        <span class="leg-item"><span class="leg-dot ld-unplayed"></span>Missed</span>
      </div>
      <div class="cal-grid">${hdrs}${blanks}${cells.join('')}</div>`;
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
      <div id="calWrap"></div>
    </div>`;

  const calWrap = document.getElementById('calWrap');

  function refresh() {
    calWrap.innerHTML = buildCal();
    document.getElementById('calPrev').onclick = () => {
      if (viewMonth === 0) { viewMonth = 11; viewYear--; } else viewMonth--;
      refresh();
    };
    document.getElementById('calNext').onclick = () => {
      if (viewMonth === 11) { viewMonth = 0; viewYear++; } else viewMonth++;
      refresh();
    };
  }

  refresh();

  // Cell clicks via delegation (survives refresh)
  calWrap.addEventListener('click', e => {
    const cell = e.target.closest('.cal-cell');
    if (!cell || cell.dataset.disabled === 'true') return;
    navigate('puzzle', { mode: 'archive', date: cell.dataset.date });
  });

  // Swipe left/right to change month
  const ttScreen = root.querySelector('.tt-screen');
  let swipeStartX = 0;
  let swipeStartY = 0;
  ttScreen.addEventListener('touchstart', e => {
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
  }, { passive: true });
  ttScreen.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - swipeStartX;
    const dy = e.changedTouches[0].clientY - swipeStartY;
    // Only act on clearly horizontal swipes (|dx| > |dy| and > 50px threshold)
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) {
      // swipe left → next month
      const canNext = !(viewYear === todayY && viewMonth === todayM - 1);
      if (!canNext) return;
      if (viewMonth === 11) { viewMonth = 0; viewYear++; } else viewMonth++;
      refresh();
    } else {
      // swipe right → prev month
      const canPrev = !(viewYear === 2026 && viewMonth === 0);
      if (!canPrev) return;
      if (viewMonth === 0) { viewMonth = 11; viewYear--; } else viewMonth--;
      refresh();
    }
  }, { passive: true });

  document.getElementById('backBtn').addEventListener('click', () => navigate('menu'));

  spawnStars('ttStars');

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
