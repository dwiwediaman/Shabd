import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Structural regression tests for bugs fixed in vc115–vc122 ─────────────
//
// Each test pins the exact CSS/code structure that a fix depends on so the
// bug cannot silently regress. No browser required — tests read source files
// directly and assert invariants.

const __dirname = dirname(fileURLToPath(import.meta.url));
const css        = readFileSync(resolve(__dirname, '../style.css'),          'utf8');
const gameStateJs = readFileSync(resolve(__dirname, '../game/gameState.js'), 'utf8');
const archiveJs   = readFileSync(resolve(__dirname, '../screens/archive.js'),'utf8');
const puzzleJs    = readFileSync(resolve(__dirname, '../screens/dailyPuzzle.js'), 'utf8');
const updateJs    = readFileSync(resolve(__dirname, '../updateCheck.js'),    'utf8');

// ── CSS helpers (same pattern as stickyHeader.test.js) ────────────────────

function rulesContaining(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const selectorBoundaryRx = new RegExp(escaped + String.raw`(?=[\s,{])`);
  const blockRx = /([^{}]+)\{([^{}]*)\}/g;
  const matches = [];
  let m;
  while ((m = blockRx.exec(css))) {
    if (selectorBoundaryRx.test(m[1])) {
      matches.push({ selectors: m[1].trim(), body: m[2] });
    }
  }
  return matches;
}

function allBodies(selector) {
  return rulesContaining(selector).map(r => r.body).join('\n');
}

// ── vc115: structuredClone removed from gameState.js ──────────────────────
// structuredClone is absent in WebView < 98 (e.g. factory-fresh Android 12).
// If it returns to gameState.js the app will hang on splash on those devices.
describe('vc115 — WebView <98 compat (structuredClone banned in gameState)', () => {
  it('gameState.js does not call structuredClone', () => {
    expect(gameStateJs).not.toMatch(/structuredClone/);
  });

  it('gameState.js uses JSON.parse(JSON.stringify()) for DEFAULTS clone', () => {
    // Both call-sites: fresh state and merge base must use the safe clone.
    const matches = [...gameStateJs.matchAll(/JSON\.parse\(JSON\.stringify\(DEFAULTS\)\)/g)];
    expect(matches.length, 'expected at least 2 JSON round-trip clones of DEFAULTS').toBeGreaterThanOrEqual(2);
  });
});

// ── vc117: stats/streak card must be centered ─────────────────────────────
// Without justify-content:center the streak/played/win-rate items cluster
// to the left when numbers are short (e.g. streak=4, single digit).
describe('vc117 — streak card centering', () => {
  it('.streak-card has justify-content: center', () => {
    const body = allBodies('.streak-card');
    expect(body).toMatch(/justify-content\s*:\s*center/);
  });
});

// ── vc118: Time Travel month-swipe boundary guards ────────────────────────
// Swipe gesture must respect the same boundary as the < > buttons:
//   - cannot go before January 2026 (LAUNCH_DATE month)
//   - cannot go past the current month
describe('vc118 — Time Travel swipe gesture', () => {
  it('archive.js registers touchstart and touchend listeners on .tt-screen', () => {
    expect(archiveJs).toMatch(/addEventListener\s*\(\s*['"]touchstart['"]/);
    expect(archiveJs).toMatch(/addEventListener\s*\(\s*['"]touchend['"]/);
  });

  it('swipe uses a minimum threshold of at least 40px', () => {
    // Prevents accidental micro-swipes from changing months.
    const thresholdMatch = archiveJs.match(/Math\.abs\(dx\)\s*<\s*(\d+)/);
    expect(thresholdMatch, 'dx threshold not found').not.toBeNull();
    const threshold = parseInt(thresholdMatch[1], 10);
    expect(threshold).toBeGreaterThanOrEqual(40);
  });

  it('swipe respects horizontal-vs-vertical filter', () => {
    // Prevents vertical scrolling being misread as a month change.
    expect(archiveJs).toMatch(/Math\.abs\(dx\).*Math\.abs\(dy\)/);
  });

  it('swipe cannot go before the launch month (2026-01)', () => {
    // The canPrev guard must reference year 2026 and month 0.
    expect(archiveJs).toMatch(/viewYear\s*===\s*2026.*viewMonth\s*===\s*0|viewMonth\s*===\s*0.*viewYear\s*===\s*2026/);
  });
});

// ── vc119: keyboard must never be cropped by the word-hint banner ─────────
// Root cause: #gridWrap had no min-height:0 so it could not yield space to
// the banner, causing the keyboard to overflow off-screen.
describe('vc119 — keyboard crop fix (word-hint banner)', () => {
  it('#gridWrap has min-height: 0 so it can shrink in flex layout', () => {
    const body = allBodies('#gridWrap');
    expect(body, '#gridWrap must have min-height: 0').toMatch(/min-height\s*:\s*0/);
  });

  it('#kbWrap has flex-shrink: 0 so keyboard is never compressed', () => {
    const body = allBodies('#kbWrap');
    expect(body, '#kbWrap must have flex-shrink: 0').toMatch(/flex-shrink\s*:\s*0/);
  });

  it('dailyPuzzle.js calls fitGrid() after renderWordHintBanner()', () => {
    // fitGrid must be called inside renderWordHintBanner (via rAF).
    const bannerFn = puzzleJs.match(/function renderWordHintBanner[\s\S]*?^  \}/m)?.[0] ?? puzzleJs;
    expect(bannerFn).toMatch(/fitGrid/);
  });

  it('fitGrid() resets transform before measuring to get natural size', () => {
    expect(puzzleJs).toMatch(/tileGrid\.style\.transform\s*=\s*['"]{2}/);
  });
});

// ── vc120: update-download banner must not cover the keyboard ─────────────
// The banner is position:fixed at the bottom. During download there is no
// dismiss button, so without compensation the last keyboard row is blocked.
describe('vc120 — update banner keyboard push-up', () => {
  it('updateCheck.js sets paddingBottom on #kbWrap when banner shows', () => {
    expect(updateJs).toMatch(/kbWrap.*paddingBottom|paddingBottom.*kbWrap/s);
  });

  it('updateCheck.js clears paddingBottom on #kbWrap when banner hides', () => {
    // hideBanner must restore '' so the keyboard returns to normal.
    const hideFn = updateJs.match(/function hideBanner[\s\S]*?\n\}/)?.[0] ?? '';
    expect(hideFn, 'hideBanner must clear kbWrap paddingBottom').toMatch(/paddingBottom\s*=\s*['"]{2}/);
  });
});

// ── vc121/122: Squads footer must be sticky ───────────────────────────────
// The invite strip + Leave Squad button must stick to the bottom of the
// viewport while the leaderboard scrolls above it.
describe('vc122 — Squads sticky footer', () => {
  it('.squad-footer has position: sticky', () => {
    const body = allBodies('.squad-footer');
    expect(body, '.squad-footer must be sticky').toMatch(/position\s*:\s*sticky/);
  });

  it('.squad-footer has bottom: 0', () => {
    const body = allBodies('.squad-footer');
    expect(body, '.squad-footer must pin to bottom: 0').toMatch(/bottom\s*:\s*0/);
  });

  it('.btn-leave-squad has width: 100%', () => {
    const body = allBodies('.btn-leave-squad');
    expect(body, 'Leave Squad button must span full width').toMatch(/width\s*:\s*100%/);
  });

  it('.squad-icon-btn exists for the icon-only copy/share buttons', () => {
    const body = allBodies('.squad-icon-btn');
    expect(body, '.squad-icon-btn rule must exist').not.toBe('');
    // Must be square touch targets (width = height)
    const wMatch = body.match(/width\s*:\s*(\d+)px/);
    const hMatch = body.match(/height\s*:\s*(\d+)px/);
    expect(wMatch, 'must have explicit width').not.toBeNull();
    expect(hMatch, 'must have explicit height').not.toBeNull();
    expect(parseInt(wMatch[1])).toBe(parseInt(hMatch[1]));
  });
});
