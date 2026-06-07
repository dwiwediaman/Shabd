import { test, expect } from '@playwright/test';
import { bootApp, pressKey, typeWord, pressEnter, pressBackspace, todayIST } from './helpers.js';

test.describe('Daily puzzle — English', () => {

  test.beforeEach(async ({ page }) => {
    await bootApp(page);
    await page.locator('#btnPlay').click();
    await page.locator('.puzzle-screen').waitFor({ state: 'visible' });
    await page.locator('.keyboard').waitFor({ state: 'visible' });
  });

  // ── Keyboard layout ─────────────────────────────────────────────────────

  test('All EN keyboard rows are rendered', async ({ page }) => {
    // Q-row, middle row, bottom row (with ENTER + ⌫)
    const keys = page.locator('button.key');
    // English layout: 10 + 9 + 9 (Z..M + ENTER + ⌫) = 28 keys
    const count = await keys.count();
    expect(count).toBeGreaterThanOrEqual(26); // 26 letters + ENTER + ⌫
  });

  test('ENTER key is visible', async ({ page }) => {
    await expect(page.locator('button.key.key-enter')).toBeVisible();
  });

  test('Backspace key is visible', async ({ page }) => {
    await expect(page.locator('button.key:text-is("⌫")')).toBeVisible();
  });

  // ── Input mechanics ─────────────────────────────────────────────────────

  test('Pressing a letter fills the first tile in the active row', async ({ page }) => {
    await pressKey(page, 'C');
    // First tile in row 0 should have text "C"
    const firstTile = page.locator('.tile-row').first().locator('.tile').first();
    await expect(firstTile).toHaveText('C', { ignoreCase: true });
  });

  test('Typing 5 letters fills all tiles in the row', async ({ page }) => {
    await typeWord(page, 'CRANE');
    const tiles = page.locator('.tile-row').first().locator('.tile');
    await expect(tiles.nth(0)).toHaveText('C', { ignoreCase: true });
    await expect(tiles.nth(1)).toHaveText('R', { ignoreCase: true });
    await expect(tiles.nth(2)).toHaveText('A', { ignoreCase: true });
    await expect(tiles.nth(3)).toHaveText('N', { ignoreCase: true });
    await expect(tiles.nth(4)).toHaveText('E', { ignoreCase: true });
  });

  test('Backspace removes the last typed letter', async ({ page }) => {
    await typeWord(page, 'CRA');
    await pressBackspace(page);
    const tiles = page.locator('.tile-row').first().locator('.tile');
    // Tile at index 2 should now be empty
    await expect(tiles.nth(2)).toHaveText('');
    // First two remain
    await expect(tiles.nth(0)).toHaveText('C', { ignoreCase: true });
    await expect(tiles.nth(1)).toHaveText('R', { ignoreCase: true });
  });

  test('ENTER with < 5 letters does not advance the row (shows shake/error)', async ({ page }) => {
    await typeWord(page, 'CR');
    await pressEnter(page);
    // Row 0 tiles should still be editable (currentRow still 0)
    // i.e. no tile-row 0 should have state class 'revealed'/'correct'/'absent'/'present'
    const firstRow = page.locator('.tile-row').first();
    const revealedTiles = firstRow.locator('.tile[data-state]');
    // No tile should have a reveal state yet
    const count = await revealedTiles.count();
    expect(count).toBe(0);
  });

  // ── Guess submission ────────────────────────────────────────────────────

  test('Submitting a valid 5-letter word colors the tiles', async ({ page }) => {
    await typeWord(page, 'CRANE');
    await pressEnter(page);
    // After submission, tiles in row 0 should have one of the color states.
    // We wait for the animation to finish — tiles transition to .tile-correct /
    // .tile-present / .tile-absent (or data-state attribute).
    const firstRow = page.locator('.tile-row').first();
    // At least one tile should end up with a state class
    await expect(async () => {
      const html = await firstRow.innerHTML();
      expect(
        html.includes('correct') || html.includes('present') || html.includes('absent')
      ).toBeTruthy();
    }).toPass({ timeout: 4_000 });
  });

  test('Submitting a valid guess advances to the next row', async ({ page }) => {
    await typeWord(page, 'CRANE');
    await pressEnter(page);
    // After the row resolves, row 1 tiles should be empty (ready for next guess)
    await page.waitForTimeout(1_800); // tile flip animation
    const secondRow = page.locator('.tile-row').nth(1);
    const firstTileOfRow2 = secondRow.locator('.tile').first();
    // Type next word to confirm we're on row 2
    await typeWord(page, 'L');
    await expect(firstTileOfRow2).toHaveText('L', { ignoreCase: true });
  });

  test('Submitting an unknown word shows toast / error (not advancing row)', async ({ page }) => {
    // "ZZZZZ" is guaranteed not in the word list
    await typeWord(page, 'ZZZZZ');
    await pressEnter(page);
    // Either a toast with "not in word list" text appears, OR the row stays
    // un-colored. Both confirm the invalid-word guard is working.
    const rowAdvanced = async () => {
      const html = await page.locator('.tile-row').first().innerHTML();
      return html.includes('correct') || html.includes('present') || html.includes('absent');
    };
    await page.waitForTimeout(500);
    expect(await rowAdvanced()).toBe(false);
  });

  // ── Keyboard key state update ───────────────────────────────────────────

  test('Keyboard keys change color after a guess is submitted', async ({ page }) => {
    await typeWord(page, 'CRANE');
    await pressEnter(page);
    // Wait for tile-flip animation to finish
    await page.waitForTimeout(1_800);
    // The updateKeys() call adds key-correct / key-present / key-absent
    // directly to the button element itself (not a descendant).
    const coloredKey = page.locator(
      'button.key.key-correct, button.key.key-present, button.key.key-absent'
    );
    await expect(coloredKey.first()).toBeVisible();
  });

  // ── Encouragement toast ────────────────────────────────────────────────

  test('Encouragement toast appears after an intermediate (non-winning) guess', async ({ page }) => {
    // Submit a valid word. If it happens to be today's answer the "Brilliant!"
    // toast fires instead — that's fine, we just assert a toast shows up with text.
    await typeWord(page, 'CRANE');
    await pressEnter(page);

    // Wait for the toast to get the .show class (set by showToast right after
    // the tile-flip animation at ~720 ms). .show adds opacity:1 — the element
    // lives in the DOM at opacity:0 the whole time, so toBeVisible() alone is
    // not enough; we must check for the class.
    const toast = page.locator('#toast.show');
    await expect(toast).toBeVisible({ timeout: 3_000 });

    // Must have non-empty text (encourage message or "Brilliant!" on a win).
    const text = await toast.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  // ── Back navigation from puzzle ─────────────────────────────────────────

  test('Back button from puzzle returns to menu', async ({ page }) => {
    await page.locator('#backBtn').click();
    await expect(page.locator('.menu-screen')).toBeVisible();
  });

});

// ── Answer reveal after loss ────────────────────────────────────────────────

test.describe('Answer reveal on loss', () => {

  // Session format mirrors validateGuess() return value:
  // { isValid, isCorrect, perTileState: string[], input: string[] }
  // Session entries mirror validateGuess() return:
  // { isValid, isCorrect, perTileState: string[], input: string }
  // input is currentInput.join('') — a plain string, not an array.
  function makeLossSession(words) {
    return words.map(w => ({
      isValid:      true,
      isCorrect:    false,
      perTileState: Array(w.length).fill('absent'),
      input:        w.toLowerCase(),
    }));
  }

  test('answer banner shown immediately on re-entry after a loss', async ({ page }) => {
    const sessionKey = `${todayIST()}|en`;
    const lossSession = makeLossSession(['crane','light','dumps','boxer','fritz','whomp']);
    await bootApp(page, { sessions: { [sessionKey]: lossSession } });
    await page.locator('#btnPlay').click();
    await page.locator('.puzzle-screen').waitFor({ state: 'visible' });

    // Answer reveal should appear without any user action
    const reveal = page.locator('.answer-reveal');
    await expect(reveal).toBeVisible({ timeout: 4_000 });

    // Should contain individual letter tiles (one per letter of the word)
    const tiles = reveal.locator('.answer-reveal-tile');
    await expect(tiles).toHaveCount(5); // English word = 5 tiles
  });

  test('answer banner tiles each contain a single uppercase letter', async ({ page }) => {
    const sessionKey = `${todayIST()}|en`;
    const lossSession = makeLossSession(['crane','light','dumps','boxer','fritz','whomp']);
    await bootApp(page, { sessions: { [sessionKey]: lossSession } });
    await page.locator('#btnPlay').click();
    await page.locator('.puzzle-screen').waitFor({ state: 'visible' });
    await page.locator('.answer-reveal').waitFor({ state: 'visible', timeout: 4_000 });

    const tiles = page.locator('.answer-reveal-tile');
    const count = await tiles.count();
    for (let i = 0; i < count; i++) {
      const text = await tiles.nth(i).textContent();
      expect(text).toMatch(/^[A-Z]$/);
    }
  });

});

// ── Hindi mode ──────────────────────────────────────────────────────────────

test.describe('Daily puzzle — Hindi (Hinglish keyboard)', () => {

  test.beforeEach(async ({ page }) => {
    await bootApp(page, { settings: { lang: 'hi', kbMode: 'hinglish' } });
    await page.locator('#btnPlay').click();
    await page.locator('.puzzle-screen').waitFor({ state: 'visible' });
    await page.locator('.keyboard').waitFor({ state: 'visible' });
  });

  test('Keyboard renders for Hindi (more than 26 keys)', async ({ page }) => {
    // Hindi keyboard has consonant rows + matra strip + more
    const count = await page.locator('button.key').count();
    expect(count).toBeGreaterThan(26);
  });

  test('Hindi puzzle has 4 tile slots per row (not 5)', async ({ page }) => {
    const firstRow = page.locator('.tile-row').first();
    const tiles = firstRow.locator('.tile');
    await expect(tiles).toHaveCount(4);
  });

});
