import { test, expect } from '@playwright/test';
import { bootApp, todayIST } from './helpers.js';

test.describe('Settings screen', () => {

  test.beforeEach(async ({ page }) => {
    await bootApp(page);
    await page.locator('#btnBurger').click();
    await page.locator('#drawerSettings').click();
    await page.locator('.settings-screen').waitFor({ state: 'visible' });
  });

  // ── Language toggle ─────────────────────────────────────────────────────

  test('Language toggle: English is active by default', async ({ page }) => {
    const enBtn = page.locator('.toggle-btn[data-val="en"]');
    await expect(enBtn).toHaveClass(/active/);
    const hiBtn = page.locator('.toggle-btn[data-val="hi"]');
    await expect(hiBtn).not.toHaveClass(/active/);
  });

  test('Language toggle: switching to Hindi re-renders settings in Hindi', async ({ page }) => {
    await page.locator('.toggle-btn[data-val="hi"]').click();
    // After switch the screen re-renders — wait for settings-screen again
    await page.locator('.settings-screen').waitFor({ state: 'visible' });
    const hiBtn = page.locator('.toggle-btn[data-val="hi"]');
    await expect(hiBtn).toHaveClass(/active/);
    // Hindi keyboard group should become fully interactive
    const kbGroup = page.locator('#kbGroup');
    await expect(kbGroup).not.toHaveCSS('pointer-events', 'none');
  });

  test('Language toggle: Hindi keyboard group is dimmed in English mode', async ({ page }) => {
    const kbGroup = page.locator('#kbGroup');
    // In English mode the group has pointer-events:none inline style
    await expect(kbGroup).toHaveCSS('pointer-events', 'none');
  });

  // ── Hindi keyboard mode ─────────────────────────────────────────────────

  test('Hindi keyboard mode toggle visible and has exactly two options', async ({ page }) => {
    const opts = page.locator('#kbGroup .toggle-btn');
    await expect(opts).toHaveCount(2);
  });

  // ── Toggle switches ─────────────────────────────────────────────────────

  // The <input type="checkbox"> inside .switch has opacity:0/width:0/height:0.
  // Click the visible <label class="switch"> wrapper instead.
  test('Sound Effects toggle persists to localStorage', async ({ page }) => {
    const input = page.locator('#soundToggle');
    const label = page.locator('label.switch').filter({ has: input });
    const initialChecked = await input.isChecked();
    await label.click();
    const newChecked = await input.isChecked();
    expect(newChecked).toBe(!initialChecked);
    const stored = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('shabd_state_v1') || '{}');
      return s?.settings?.sound;
    });
    expect(stored).toBe(newChecked);
  });

  test('Haptics toggle persists to localStorage', async ({ page }) => {
    const input = page.locator('#hapticToggle');
    const label = page.locator('label.switch').filter({ has: input });
    const was = await input.isChecked();
    await label.click();
    const stored = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('shabd_state_v1') || '{}');
      return s?.settings?.haptics;
    });
    expect(stored).toBe(!was);
  });

  test('Hard Mode toggle: unlocked before puzzle starts', async ({ page }) => {
    const input = page.locator('#hardModeToggle');
    const label = page.locator('label.switch').filter({ has: input });
    // No puzzle played today → input should NOT be disabled
    await expect(input).not.toBeDisabled();
    const was = await input.isChecked();
    await label.click();
    const stored = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('shabd_state_v1') || '{}');
      return s?.settings?.hardMode;
    });
    expect(stored).toBe(!was);
  });

  // ── Header layout (regression for blank-gap bug on Android 14) ──────────

  test('Settings header: back button is visible near the top of the screen', async ({ page }) => {
    const backBtn = page.locator('#backBtn');
    await expect(backBtn).toBeVisible();
    const box = await backBtn.boundingBox();
    // The button should appear in the top ~25 % of the viewport (844 px tall).
    // A large blank gap (Android 14 bug) would push it below this threshold.
    expect(box.y).toBeLessThan(page.viewportSize().height * 0.25);
  });

  // ── Cloud section ───────────────────────────────────────────────────────

  test('Cloud section is hidden in browser (not native)', async ({ page }) => {
    // Capacitor.isNativePlatform() returns false in browser →
    // cloudSectionHtml() returns '' → #cloudGroup should not exist.
    await expect(page.locator('#cloudGroup')).toHaveCount(0);
  });

});

// Hard-mode-locked test uses its own describe so it can call bootApp with a
// pre-seeded session (gameState caches state in-memory on load; patching
// localStorage after boot doesn't affect the running page).
test.describe('Settings screen — hard mode locked', () => {
  test('Hard Mode toggle: locked after today\'s puzzle is started', async ({ page }) => {
    // Prime localStorage with one guess for today BEFORE the page boots.
    const sessionKey = `${todayIST()}|en`;
    await bootApp(page, {
      sessions: { [sessionKey]: [{ tiles: [], isCorrect: false }] },
    });
    await page.locator('#btnBurger').click();
    await page.locator('#drawerSettings').click();
    await page.locator('.settings-screen').waitFor({ state: 'visible' });
    await expect(page.locator('#hardModeToggle')).toBeDisabled();
  });
});
