import { test, expect } from '@playwright/test';

test('island and game entry points link to each other', async ({ page }) => {
  for (const [width, height] of [[1440, 1000], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const play = page.locator('#play-game');
    await expect(play).toBeVisible();
    await play.click();
    await expect(page).toHaveURL(/\/game\/$/);
    await expect(page).toHaveTitle('午安新竹');
    const home = page.locator('#title a.home');
    await expect(home).toBeVisible();
    await home.click();
    await expect(page).toHaveTitle(/新竹風城島/);
  }
});
