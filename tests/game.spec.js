import { test, expect } from '@playwright/test';

for (const mode of ['3d', '2d', 'cdn-failure']) {
  test(`game completes and replays with ${mode}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    if (mode === 'cdn-failure') await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
    await page.goto(`/game/${mode === '2d' ? '#2d' : ''}`);
    await page.waitForFunction(() => window.__game?.ready === true);
    expect(await page.evaluate(() => window.__game.renderer())).toBe(mode === '3d' ? '3d' : '2d');
    await page.locator('#btnStd').click();
    expect(await page.evaluate(() => window.__game.state().over)).toBe(false);
    // Advance simulation time without waiting three real minutes.
    await page.evaluate(() => window.__game.jump(181));
    await expect(page.locator('#results')).toBeVisible();
    expect(await page.evaluate(() => window.__game.state().over)).toBe(true);
    await page.locator('#btnAgain').click();
    await expect(page.locator('#results')).toBeHidden();
    expect(await page.evaluate(() => window.__game.state().over)).toBe(false);
    expect(errors).toEqual([]);
  });
}
