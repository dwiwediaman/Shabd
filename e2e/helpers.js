/**
 * Shared helpers for Shabd E2E tests.
 */

const STATE_KEY = 'shabd_state_v1';

/** Minimal persisted state — tutorial seen, English, clean slate. */
const BASE_STATE = {
  flags:    { seenTutorial: true },
  settings: { lang: 'en', kbMode: 'hinglish', sound: false, haptics: false,
               notifications: false, hardMode: false },
  streak:   { hi: { current: 0, max: 0, lastDate: '' },
               en: { current: 0, max: 0, lastDate: '' } },
  stats:    { hi: { played: 0, won: 0, dist: [0,0,0,0,0,0] },
               en: { played: 0, won: 0, dist: [0,0,0,0,0,0] } },
  freezes:  { hi: { count: 0, lastResetWeek: '' },
               en: { count: 0, lastResetWeek: '' } },
  sessions: {},
  sessionMeta: {},
};

/**
 * Navigate to the app with a preset localStorage state so tests never land
 * on the first-launch tutorial and always start from a known baseline.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [stateOverride]  Deep-merged on top of BASE_STATE.
 */
export async function bootApp(page, stateOverride = {}) {
  // Prime localStorage BEFORE the page script runs — use addInitScript so
  // the value is there from the very first JS execution context.
  const merged = deepMerge(structuredClone(BASE_STATE), stateOverride);
  await page.addInitScript(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [STATE_KEY, merged]);

  await page.goto('/');
  await waitForMenu(page);
}

/**
 * Wait until the main menu is fully visible.
 * Boot sequence: loader (1 500 ms) → fade (400 ms) → #app.visible → menu render.
 */
export async function waitForMenu(page) {
  // #app gets .visible after the loader fades; menu-screen renders right after.
  await page.locator('.menu-screen').waitFor({ state: 'visible', timeout: 8_000 });
}

/**
 * Wait until the loader is gone and #app is visible (pre-menu state).
 */
export async function waitForBoot(page) {
  await page.locator('#loader').waitFor({ state: 'hidden', timeout: 8_000 });
  await page.locator('#app.visible').waitFor({ state: 'attached', timeout: 2_000 });
}

/**
 * Click a key on the on-screen keyboard by its label.
 * Uses exact text match so 'E' doesn't accidentally hit 'ENTER'.
 */
export async function pressKey(page, label) {
  // keyboard key buttons all have class="key …"
  await page.locator(`button.key:text-is("${label}")`).click();
}

/**
 * Type a full word using the on-screen keyboard (uppercase letters, one by one).
 */
export async function typeWord(page, word) {
  for (const ch of word.toUpperCase()) {
    await pressKey(page, ch);
  }
}

/** Submit the current row. */
export async function pressEnter(page) {
  await page.locator('button.key.key-enter').click();
}

/** Backspace one letter. */
export async function pressBackspace(page) {
  await page.locator('button.key:text-is("⌫")').click();
}

/**
 * Return today's date in IST (YYYY-MM-DD) — mirrors getISTDate() in seedEngine.js.
 * Used in tests to build session keys without a page.evaluate() round-trip.
 */
export function todayIST() {
  const IST_OFFSET_MS = 19800 * 1000; // +5:30
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Tiny deep-merge (same logic as gameState.js) ─────────────────────────
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
