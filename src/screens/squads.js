// Squads screen — private leaderboards.
//
// Layout depends on state:
//   - Not signed in (native)        → sign-in prompt
//   - Signed in, no squads          → empty state with Create / Join cards
//   - Signed in, 1+ squads          → list of squads (tap = open detail)
//   - Squad detail                  → today's leaderboard + invite/share
//
// All API calls go through src/cloud/squads.js.

import { navigate } from '../components/router.js';
import { get } from '../game/gameState.js';
import { getISTDate } from '../game/seedEngine.js';
import { t } from '../i18n.js';
import { Capacitor } from '@capacitor/core';
import { isSignedIn, signIn } from '../cloud/auth.js';
import { syncAfterSignIn } from '../cloud/sync.js';
import {
  createSquad, joinSquad, listMySquads,
  getSquadBoard, leaveOrDisbandSquad, previewSquad,
} from '../cloud/squads.js';
import { Share } from '@capacitor/share';

// Top-level entry — picks the right view based on params.
//   navigate('squads')                       → list view
//   navigate('squads', { squadId: '...' })   → detail view
//   navigate('squads', { joinCode: 'ABC' })  → deep-link join flow
export function squadsScreen(root, params = {}) {
  const lang = get().settings.lang;
  const tx   = t(lang);

  // Deep-link join flow: arrives here from shabd://squad/<code>.
  // Renders the list view in the background and overlays a preview /
  // confirm-to-join modal. Works whether or not the user is signed in
  // (preview endpoint is public; signing in is deferred to the "Join" tap).
  if (params.joinCode) {
    handleDeepLinkJoin(root, tx, params.joinCode);
    return;
  }

  if (!Capacitor.isNativePlatform() || !isSignedIn()) {
    renderSignInPrompt(root, tx);
    return;
  }

  if (params.squadId) {
    renderSquadDetail(root, tx, params.squadId);
  } else {
    renderSquadsList(root, tx);
  }
}

// ── Deep-link join flow ────────────────────────────────────────────────────
// 1. Render the appropriate background screen (sign-in prompt OR squads list)
// 2. Fetch public preview of the squad
// 3. Show a confirm modal: name, member count, owner — with [Join] / [Cancel]
// 4. If signed out, the Join button signs in first, then joins
async function handleDeepLinkJoin(root, tx, rawCode) {
  const code = String(rawCode).trim().toUpperCase();

  // Render an appropriate background so the modal doesn't sit on a blank screen
  if (!Capacitor.isNativePlatform() || !isSignedIn()) {
    renderSignInPrompt(root, tx);
  } else {
    renderSquadsList(root, tx);
  }

  // Show a loading modal immediately — preview fetch may take a moment
  const loading = openModal(`
    <div class="modal-title">${tx.squadsDeepLinkTitle}</div>
    <div class="squads-loading" style="margin:14px 0;">${tx.cloudSyncing}</div>
  `);

  let preview;
  try {
    preview = await previewSquad(code);
  } catch (e) {
    loading.close();
    const msg = e?.code === 'invalid_code' ? tx.squadsErrorInvalidCode : tx.cloudNetworkError;
    toast(msg);
    return;
  }
  loading.close();

  showDeepLinkConfirmModal(tx, code, preview);
}

function showDeepLinkConfirmModal(tx, code, preview) {
  const signedIn   = isSignedIn();
  const joinLabel  = signedIn ? tx.squadsDeepLinkJoin : tx.squadsDeepLinkSignInAndJoin;
  const memberLine = tx.squadsDeepLinkMembers(preview.memberCount, preview.max);

  const m = openModal(`
    <div class="modal-title">${tx.squadsDeepLinkTitle}</div>
    <div class="squads-deeplink-card">
      <div class="squads-deeplink-emoji">🏅</div>
      <div class="squads-deeplink-name">${escapeHtml(preview.name)}</div>
      <div class="squads-deeplink-meta">${memberLine}</div>
      ${preview.owner ? `<div class="squads-deeplink-owner">${tx.squadsDeepLinkOwner(preview.owner)}</div>` : ''}
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="modalCancel">${tx.squadsCancel}</button>
      <button class="btn-primary"   id="modalSubmit">${joinLabel}</button>
    </div>
  `);

  m.card.querySelector('#modalCancel').addEventListener('click', m.close);
  const submitBtn = m.card.querySelector('#modalSubmit');
  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true;
    try {
      if (!isSignedIn()) {
        // Sign-in deferred until the user actually wanted to commit.
        // After signing in, push any pre-existing local sessions so the
        // user's history isn't stuck on the device that signed in first.
        await signIn();
        await syncAfterSignIn();
      }
      const resp = await joinSquad(code);
      m.close();
      navigate('squads', { squadId: resp.squadId });
    } catch (e) {
      console.warn('[squads] deep-link join failed:', e);
      const reason = e?.message || '';
      if (reason === 'cancelled') { submitBtn.disabled = false; return; }
      const msg = e?.code === 'invalid_code' ? tx.squadsErrorInvalidCode
                : e?.code === 'squad_full'   ? tx.squadsErrorFull
                : reason.startsWith('google:') || reason.startsWith('init:') || reason.startsWith('server')
                  ? tx.cloudSignInError + ' (' + reason + ')'
                  : tx.cloudNetworkError;
      toast(msg);
      submitBtn.disabled = false;
    }
  });
}

// ── Sign-in prompt (shown to web users + signed-out native users) ──────────
function renderSignInPrompt(root, tx) {
  root.innerHTML = baseChrome(tx, /*showBack*/true, `
    <div class="squads-empty-state">
      <div class="squads-icon-big">🏆</div>
      <div class="squads-empty-title">${tx.squadsTitle}</div>
      <p class="squads-empty-sub">${tx.squadsSignInPrompt}</p>
      ${Capacitor.isNativePlatform() ? `
        <button class="btn-google-signin" id="squadsSignInBtn" style="max-width:280px;margin:24px auto 0;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21.35 11.1H12v3.84h5.36c-.23 1.23-.93 2.27-1.98 2.97v2.46h3.21c1.88-1.74 2.96-4.3 2.96-7.34 0-.6-.06-1.17-.2-1.93z" fill="#4285F4"/>
            <path d="M12 22c2.7 0 4.96-.9 6.61-2.43l-3.21-2.46c-.9.6-2.04.96-3.4.96-2.61 0-4.82-1.76-5.6-4.13H3.07v2.6C4.72 19.7 8.1 22 12 22z" fill="#34A853"/>
            <path d="M6.4 13.94a6 6 0 010-3.88v-2.6H3.07a10 10 0 000 9.08l3.33-2.6z" fill="#FBBC05"/>
            <path d="M12 6c1.47 0 2.78.5 3.82 1.5l2.86-2.86C16.96 3.05 14.7 2 12 2 8.1 2 4.72 4.3 3.07 7.46l3.33 2.6C7.18 7.76 9.39 6 12 6z" fill="#EA4335"/>
          </svg>
          <span>${tx.cloudSignIn}</span>
        </button>
      ` : ''}
    </div>
  `);
  wireBack(root);
  const btn = document.getElementById('squadsSignInBtn');
  if (btn) btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await signIn();
      // Backfill pre-existing local sessions to the cloud before navigating.
      // Without this, a user whose first sign-in is via Squads (not Settings)
      // would see their history "start from joining date" on other devices.
      await syncAfterSignIn();
      navigate('squads');
    } catch (e) {
      console.warn('[squads] signin failed:', e);
      btn.disabled = false;
      const msg = e?.message || '';
      if (msg === 'cancelled') return; // user dismissed, no toast
      // Show the stage-tagged reason so we can diagnose
      const tx = t(get().settings.lang);
      toast(tx.cloudSignInError + ' (' + (msg || 'unknown') + ')');
    }
  });
}

// ── Squad list (or empty state) ────────────────────────────────────────────
async function renderSquadsList(root, tx) {
  root.innerHTML = baseChrome(tx, /*showBack*/true, `
    <div id="squadsBody">
      <div class="squads-loading">${tx.cloudSyncing}</div>
    </div>
  `);
  wireBack(root);

  let squads;
  try { squads = await listMySquads(); }
  catch (e) {
    document.getElementById('squadsBody').innerHTML =
      `<div class="squads-error">${tx.cloudNetworkError}</div>`;
    return;
  }

  if (!squads.length) {
    document.getElementById('squadsBody').innerHTML = `
      <div class="squads-empty-state">
        <div class="squads-icon-big">🤝</div>
        <p class="squads-empty-sub">${tx.squadsEmpty}</p>
        <div class="squads-empty-actions">
          <button class="btn-primary" id="squadCreateBtn">
            ${tx.squadsCreateBtn}
          </button>
          <button class="btn-secondary" id="squadJoinBtn">
            ${tx.squadsJoinBtn}
          </button>
        </div>
      </div>
    `;
  } else {
    document.getElementById('squadsBody').innerHTML = `
      <div class="squads-list">
        ${squads.map(s => squadCardHtml(s, tx)).join('')}
      </div>
      <div class="squads-list-actions">
        <button class="btn-secondary btn-with-sub" id="squadCreateBtn">
          <div class="btn-text">
            <div class="btn-text-main">${tx.squadsCreateBtn}</div>
          </div>
        </button>
        <button class="btn-secondary btn-with-sub" id="squadJoinBtn">
          <div class="btn-text">
            <div class="btn-text-main">${tx.squadsJoinBtn}</div>
          </div>
        </button>
      </div>
    `;
    document.querySelectorAll('[data-squad-id]').forEach(el => {
      el.addEventListener('click', () => {
        navigate('squads', { squadId: el.dataset.squadId });
      });
    });
  }

  document.getElementById('squadCreateBtn')?.addEventListener('click', () => showCreateModal(tx));
  document.getElementById('squadJoinBtn')?.addEventListener('click',   () => showJoinModal(tx));
}

function squadCardHtml(s, tx) {
  return `
    <button class="squad-card" data-squad-id="${escapeHtml(s.squadId)}">
      <div class="squad-card-emoji">🏅</div>
      <div class="squad-card-main">
        <div class="squad-card-name">${escapeHtml(s.name)}</div>
        <div class="squad-card-meta">
          ${tx.squadsMembers(s.memberCount)} · ${escapeHtml(s.inviteCode)}
          ${s.isOwner ? ` · 👑` : ''}
        </div>
      </div>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:.5">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  `;
}

// ── Squad detail (leaderboard) ─────────────────────────────────────────────
async function renderSquadDetail(root, tx, squadId) {
  const lang = get().settings.lang;
  const date = getISTDate();
  // Persist the user's last-selected timeframe across re-renders within
  // this screen session. Reset to 'day' on each fresh navigation.
  let currentWindow = 'day';

  root.innerHTML = baseChrome(tx, /*showBack*/true, `
    <div id="squadDetailBody">
      <div class="squads-loading">${tx.cloudSyncing}</div>
    </div>
  `);
  wireBack(root, () => navigate('squads'));

  async function refresh() {
    const body = document.getElementById('squadDetailBody');
    body.innerHTML = `<div class="squads-loading">${tx.cloudSyncing}</div>`;

    let board;
    try { board = await getSquadBoard(squadId, date, lang, currentWindow); }
    catch (e) {
      body.innerHTML = `<div class="squads-error">${tx.cloudNetworkError}</div>`;
      return;
    }

    const subLine = currentWindow === 'day'
      ? `${tx.squadsToday} · ${escapeHtml(date)} · ${board.lang.toUpperCase()}`
      : currentWindow === 'week'
        ? `${tx.squadsThisWeek} · ${escapeHtml(board.windowStart)} → ${escapeHtml(board.windowEnd)} · ${board.lang.toUpperCase()}`
        : `${tx.squadsAllTime} · ${board.lang.toUpperCase()}`;

    body.innerHTML = `
      <div class="squad-detail-header">
        <div class="squad-detail-title">${escapeHtml(board.name)}</div>
        <div class="squad-detail-sub">${subLine}</div>
      </div>

      <div class="squad-tabs" role="tablist">
        <button class="squad-tab ${currentWindow === 'day'  ? 'is-active' : ''}" data-window="day">${tx.squadsToday}</button>
        <button class="squad-tab ${currentWindow === 'week' ? 'is-active' : ''}" data-window="week">${tx.squadsThisWeek}</button>
        <button class="squad-tab ${currentWindow === 'all'  ? 'is-active' : ''}" data-window="all">${tx.squadsAllTime}</button>
      </div>

      <div class="squad-board">
        <div class="squad-board-header">
          <span>${tx.squadsMembersCap(board.memberCount, 50)}</span>
          ${board.myRank > 0 ? `<span class="squad-my-rank">${tx.squadsMyRank(board.myRank, board.memberCount)}</span>` : ''}
        </div>
        <div class="squad-board-list">
          ${board.members.map((m, i) => squadBoardRowHtml(m, i + 1, tx, currentWindow)).join('')}
        </div>
      </div>

      <div class="squad-footer">
        <div class="squad-invite-strip">
          <div class="squad-invite-strip-left">
            <div class="squad-invite-label">${tx.squadsInviteCodeLabel}</div>
            <div class="squad-invite-code" id="squadCodeText">${escapeHtml(board.inviteCode)}</div>
          </div>
          <div class="squad-invite-actions">
            <button class="squad-icon-btn" id="squadCopyBtn" title="${tx.squadsCopyCode}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="squad-icon-btn" id="squadShareBtn" title="${tx.squadsInviteShare}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
          </div>
        </div>
        <button class="btn-leave-squad" id="squadLeaveBtn">
          ${tx.squadsLeaveSquad}
        </button>
      </div>
    `;

    // Wire tab clicks
    body.querySelectorAll('.squad-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = btn.dataset.window;
        if (w === currentWindow) return;
        currentWindow = w;
        refresh();
      });
    });

    document.getElementById('squadCopyBtn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(board.inviteCode);
        toast(tx.squadsCodeCopied);
      } catch { toast(tx.cloudNetworkError); }
    });

    document.getElementById('squadShareBtn').addEventListener('click', async () => {
      const message = tx.squadsInviteMsg(board.name, board.inviteCode);
      try {
        if (Capacitor.isNativePlatform()) {
          await Share.share({ title: 'Shabd Squad', text: message, dialogTitle: tx.squadsInviteShare });
        } else if (navigator.share) {
          await navigator.share({ text: message });
        } else {
          await navigator.clipboard.writeText(message);
          toast(tx.squadsCodeCopied);
        }
      } catch (e) { /* user cancel — ignore */ }
    });

    document.getElementById('squadLeaveBtn').addEventListener('click', () => {
      showConfirmModal(tx.squadsConfirmLeave, tx.squadsLeaveSquad, tx, async () => {
        try {
          await leaveOrDisbandSquad(squadId);
          navigate('squads');
        } catch { toast(tx.cloudNetworkError); }
      });
    });
  }

  refresh();
}

function squadBoardRowHtml(m, position, tx, window = 'day') {
  // The score chip is consistent across windows; what differs is what we
  // show underneath:
  //   - day:  per-puzzle status ("Won in 3" / "Did not solve" / "Not played")
  //   - week: gamesPlayed/7 with wins
  //   - all:  lifetime gamesPlayed + wins
  const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `#${position}`;

  let scoreText, subLine, hardBadge = '';
  if (window === 'day') {
    scoreText = m.played ? `${m.score ?? 0} ${tx.squadsPts}` : '—';
    if (m.won)         subLine = `<span class="rank-status won">${tx.squadsRankWon(m.attempts)}</span>`;
    else if (m.played) subLine = `<span class="rank-status lost">${tx.squadsRankLost}</span>`;
    else               subLine = `<span class="rank-status notyet">${tx.squadsRankNotPlayed}</span>`;
    if (m.hardMode)    hardBadge = ` <span class="hard-badge">${tx.squadsHardModeBadge}</span>`;
  } else {
    scoreText = `${m.score ?? 0} ${tx.squadsPts}`;
    const played = m.gamesPlayed ?? 0;
    const won    = m.gamesWon    ?? 0;
    subLine = window === 'week'
      ? `<span class="rank-status ${played ? 'won' : 'notyet'}">${tx.squadsWeekStats(played, won)}</span>`
      : `<span class="rank-status ${played ? 'won' : 'notyet'}">${tx.squadsAllStats(played, won)}</span>`;
  }

  return `
    <div class="squad-row ${m.isMe ? 'is-me' : ''}">
      <div class="squad-row-rank">${medal}</div>
      <div class="squad-row-name">
        ${escapeHtml(m.nickname)}${hardBadge}
      </div>
      <div class="squad-row-meta">
        <span class="squad-row-score">${scoreText}</span>
        ${subLine}
      </div>
    </div>
  `;
}

// ── Modals ─────────────────────────────────────────────────────────────────

/** Generic two-button confirm modal. Calls onConfirm() if the user presses the
 *  action button. Uses openModal so it matches the rest of the squads UI. */
function showConfirmModal(message, confirmLabel, tx, onConfirm) {
  const m = openModal(`
    <div class="modal-title">${message}</div>
    <div class="modal-actions">
      <button class="btn-secondary" id="modalCancel">${tx.squadsCancel}</button>
      <button class="btn-primary"   id="modalConfirm">${confirmLabel}</button>
    </div>
  `);
  m.card.querySelector('#modalCancel').addEventListener('click', m.close);
  m.card.querySelector('#modalConfirm').addEventListener('click', async () => {
    m.close();
    await onConfirm();
  });
}

function showCreateModal(tx) {
  const m = openModal(`
    <div class="modal-title">${tx.squadsCreateTitle}</div>
    <label class="modal-label">${tx.squadsCreateNameLabel}</label>
    <input id="modalNameInput" class="modal-input" placeholder="${tx.squadsCreateNamePlaceholder}" maxlength="32" />
    <div class="modal-actions">
      <button class="btn-secondary" id="modalCancel">${tx.squadsCancel}</button>
      <button class="btn-primary" id="modalSubmit">${tx.squadsCreate}</button>
    </div>
  `);
  const nameInput = m.card.querySelector('#modalNameInput');
  const submitBtn = m.card.querySelector('#modalSubmit');
  setTimeout(() => nameInput?.focus(), 50);
  m.card.querySelector('#modalCancel').addEventListener('click', m.close);
  submitBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) return;
    submitBtn.disabled = true;
    try {
      const resp = await createSquad(name);
      m.close();
      navigate('squads', { squadId: resp.squadId });
    } catch (e) {
      console.warn('[squads] create failed:', e);
      toast(tx.cloudNetworkError);
      submitBtn.disabled = false;
    }
  });
}

function showJoinModal(tx) {
  const m = openModal(`
    <div class="modal-title">${tx.squadsJoinTitle}</div>
    <label class="modal-label">${tx.squadsJoinCodeLabel}</label>
    <input id="modalCodeInput" class="modal-input" placeholder="${tx.squadsJoinPlaceholder}" maxlength="6" style="text-transform:uppercase;letter-spacing:2px;font-weight:700;text-align:center;" />
    <div class="modal-actions">
      <button class="btn-secondary" id="modalCancel">${tx.squadsCancel}</button>
      <button class="btn-primary" id="modalSubmit">${tx.squadsJoin}</button>
    </div>
  `);
  const codeInput = m.card.querySelector('#modalCodeInput');
  const submitBtn = m.card.querySelector('#modalSubmit');
  setTimeout(() => codeInput?.focus(), 50);
  m.card.querySelector('#modalCancel').addEventListener('click', m.close);
  submitBtn.addEventListener('click', async () => {
    const code = codeInput.value.trim().toUpperCase();
    if (!code) return;
    submitBtn.disabled = true;
    try {
      const resp = await joinSquad(code);
      m.close();
      navigate('squads', { squadId: resp.squadId });
    } catch (e) {
      const msg = e.code === 'invalid_code' ? tx.squadsErrorInvalidCode
                : e.code === 'squad_full'   ? tx.squadsErrorFull
                : tx.cloudNetworkError;
      toast(msg);
      submitBtn.disabled = false;
    }
  });
}

// ── Shared chrome ──────────────────────────────────────────────────────────
function baseChrome(tx, showBack, innerHtml) {
  return `
    <div class="stars" id="squadStars"></div>
    <div class="orb orb-1"></div>
    <div class="squads-screen">
      <div class="stats-header">
        ${showBack ? `<button class="stats-back" id="squadsBackBtn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>` : ''}
        <div class="stats-title">${tx.squadsTitle}</div>
        ${showBack ? `<div style="width:44px"></div>` : ''}
      </div>
      ${innerHtml}
    </div>
  `;
}

function wireBack(root, customHandler) {
  document.getElementById('squadsBackBtn')?.addEventListener('click',
    customHandler || (() => navigate('menu'))
  );
  spawnStars();
}

function spawnStars() {
  const el = document.getElementById('squadStars');
  if (!el) return;
  for (let i = 0; i < 40; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const sz = Math.random() * 2 + 0.5;
    s.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random()*100}%;top:${Math.random()*100}%;animation-delay:${Math.random()*3}s;animation-duration:${2+Math.random()*3}s;`;
    el.appendChild(s);
  }
}

function openModal(innerHtml) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  const card = document.createElement('div');
  card.className = 'modal-card';
  card.innerHTML = innerHtml;
  bg.appendChild(card);
  document.body.appendChild(bg);
  requestAnimationFrame(() => bg.classList.add('show'));

  const close = () => {
    bg.classList.remove('show');
    setTimeout(() => bg.remove(), 200);
  };
  bg.addEventListener('click', e => { if (e.target === bg) close(); });
  // Return `card` so callers scope queries with card.querySelector instead of
  // document.getElementById — important when two modals briefly coexist
  // (e.g. loading → confirm transition, or a duplicated deep-link event)
  // because getElementById returns the FIRST match across the whole document
  // and would silently bind handlers to a hidden/older modal's buttons.
  return { close, card };
}

function toast(msg) {
  const existing = document.querySelector('.squad-toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'squad-toast menu-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 3000);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}
