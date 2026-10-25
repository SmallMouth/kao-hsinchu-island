import { test, expect } from '@playwright/test';

test('desktop city, content search, filters and source cautions', async ({ page }) => {
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({ width:1440,height:1000 });
  await page.goto('/');
  await expect(page.locator('.island-label')).toHaveCount(13);
  await expect(page.locator('#stage canvas')).toBeVisible();
  await page.locator('[data-category="c1"].category-toggle').click();
  await expect(page.locator('#items-c1 .item')).toHaveCount(3);
  await page.locator('[data-item="3"]').click();
  await expect(page.locator('#detail')).toBeVisible();
  await expect(page.locator('#detail .notice')).toContainText('待核對');
  await page.keyboard.press('Escape');
  await page.locator('[data-filter="pending"]').click();
  await expect(page.locator('.item')).toHaveCount(8);
  await expect(page.locator('#list-summary')).toHaveText('找到 8 項紀錄');
  await page.locator('[data-item="85"]').click();
  await expect(page.locator('.detail-description')).toContainText('2026年現行金額仍為每胎3萬元');
  await expect(page.locator('#detail .status')).toHaveText('推動中／尚未實施');
  await page.keyboard.press('Escape');
  await page.locator('[data-filter="all"]').click();
  await page.locator('#search').fill('YouBike');
  await expect(page.locator('.item')).toHaveCount(3);
  await page.locator('#search').fill('不存在的搜尋項目XYZ');
  await expect(page.locator('.empty')).toBeVisible();
  await page.locator('#clear-search').click();
  await expect(page.locator('.category')).toHaveCount(13);
  await page.locator('#labels').click();
  await expect(page.locator('.island-label').first()).toBeHidden();
  await page.locator('#labels').click();
  await page.locator('#topview').click();
  await expect(page.locator('#topview')).toHaveAttribute('aria-pressed','true');
  await page.locator('#daylight').fill('20');
  await expect(page.locator('#time-label')).toHaveText('20:00');
  await page.locator('#sources').click();
  await expect(page.locator('#info')).toContainText('尚未逐項完成外部查證');
  expect(errors).toEqual([]);
});

test('mobile list, selection and dialog are reachable without overflow', async ({ page }) => {
  await page.setViewportSize({ width:390,height:844 });
  await page.goto('/');
  await expect(page.locator('.island-label')).toHaveCount(13);
  await expect(page.locator('#sidebar')).toHaveAttribute('inert','');
  await expect.poll(async () => page.locator('.island-label').evaluateAll(nodes => nodes.every(node => {const r=node.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top > 300 && r.bottom < 700;}))).toBeTruthy();
  await page.locator('#open-index').click();
  await expect(page.locator('#search')).toBeFocused();
  await page.locator('#search').fill('生育津貼');
  await expect(page.locator('.item')).toHaveCount(2);
  await page.locator('[data-item="85"]').click();
  await expect(page.locator('#detail-title')).toHaveText('生育津貼提高至6萬元');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-item="85"]')).toBeFocused();
  await page.locator('#close-index').click();
  await expect(page.locator('#sidebar')).toHaveAttribute('inert','');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.locator('#help').click();
  await expect(page.locator('#info')).toBeVisible();
});

test('WebGL failure retains the complete searchable content', async ({ page }) => {
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.includes('webgl')?null:original.call(this,type,...args);};});
  await page.goto('/');
  await expect(page.locator('.fallback')).toBeVisible();
  await page.locator('#search').fill('生育津貼');
  await expect(page.locator('.item')).toHaveCount(2);
});
