import { test, expect } from '@playwright/test';
import { bootApp, waitForMenu } from './helpers.js';

test.describe('Navigation — menu ↔ screens', () => {

  test('main menu renders core buttons and burger', async ({ page }) => {
    await bootApp(page);
    await expect(page.locator('#btnPlay')).toBeVisible();
    await expect(page.locator('#btnArchive')).toBeVisible();
    await expect(page.locator('#btnSquads')).toBeVisible();
    await expect(page.locator('#btnBurger')).toBeVisible();
    // Stats is on main screen as tappable streak card
    await expect(page.locator('#btnStats')).toBeVisible();
    // Settings lives in drawer only
    await expect(page.locator('#btnSettings')).toHaveCount(0);
  });

  test('burger opens drawer; close button closes it', async ({ page }) => {
    await bootApp(page);
    await expect(page.locator('.drawer')).not.toHaveClass(/drawer-open/);
    await page.locator('#btnBurger').click();
    await expect(page.locator('.drawer')).toHaveClass(/drawer-open/);
    await page.locator('#drawerClose').click();
    await expect(page.locator('.drawer')).not.toHaveClass(/drawer-open/);
  });

  test('backdrop click closes the drawer', async ({ page }) => {
    await bootApp(page);
    await page.locator('#btnBurger').click();
    await expect(page.locator('.drawer')).toHaveClass(/drawer-open/);
    await page.locator('#drawerBackdrop').click();
    await expect(page.locator('.drawer')).not.toHaveClass(/drawer-open/);
  });

  test('drawer contains Stats, Settings, Rules, Invite', async ({ page }) => {
    await bootApp(page);
    await page.locator('#btnBurger').click();
    await expect(page.locator('#drawerStats')).toBeVisible();
    await expect(page.locator('#drawerSettings')).toBeVisible();
    await expect(page.locator('#drawerRules')).toBeVisible();
    await expect(page.locator('#drawerInvite')).toBeVisible();
  });

  test('Settings opens from drawer and back returns to menu', async ({ page }) => {
    await bootApp(page);
    await page.locator('#btnBurger').click();
    await page.locator('#drawerSettings').click();
    await expect(page.locator('.settings-screen')).toBeVisible();
    await page.locator('#backBtn').click();
    await expect(page.locator('.menu-screen')).toBeVisible();
  });

  test('Stats opens from tappable streak card and back returns to menu', async ({ page }) => {
    await bootApp(page);
    await page.locator('#btnStats').click();
    await expect(page.locator('.stats-screen')).toBeVisible();
    await page.locator('#backBtn').click();
    await expect(page.locator('.menu-screen')).toBeVisible();
  });

  test('Stats also accessible from drawer', async ({ page }) => {
    await bootApp(page);
    await page.locator('#btnBurger').click();
    await page.locator('#drawerStats').click();
    await expect(page.locator('.stats-screen')).toBeVisible();
    await page.locator('#backBtn').click();
    await expect(page.locator('.menu-screen')).toBeVisible();
  });

  test('How to Play opens from drawer and back returns to menu', async ({ page }) => {
    await bootApp(page);
    await page.locator('#btnBurger').click();
    await page.locator('#drawerRules').click();
    await expect(page.locator('.htp-screen')).toBeVisible();
    await page.locator('#backBtn').click();
    await expect(page.locator('.menu-screen')).toBeVisible();
  });

  test('Archive opens and back returns to menu', async ({ page }) => {
    await bootApp(page);
    await page.locator('#btnArchive').click();
    await expect(page.locator('.tt-screen')).toBeVisible();
    await page.locator('#backBtn').click();
    await expect(page.locator('.menu-screen')).toBeVisible();
  });

  test('Play Today opens the daily puzzle', async ({ page }) => {
    await bootApp(page);
    await page.locator('#btnPlay').click();
    await expect(page.locator('.puzzle-screen')).toBeVisible();
    await expect(page.locator('.keyboard')).toBeVisible();
  });

  test('first-launch: tutorial shown when seenTutorial is false', async ({ page }) => {
    await page.addInitScript(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    }, ['shabd_state_v1', { flags: { seenTutorial: false } }]);
    await page.goto('/');
    await page.locator('.htp-screen').waitFor({ state: 'visible', timeout: 8_000 });
    await expect(page.locator('.menu-screen')).not.toBeVisible();
  });

});
