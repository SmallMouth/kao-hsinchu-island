import { test, expect } from '@playwright/test';

const ready = async page => {
  await page.goto('/');
  await expect(page.locator('#life-character')).toBeVisible();
};
const snapshot = page => page.evaluate(()=>window.__city.getLifeSnapshot());

test('avatar customization persists safely and updates the actual city model', async ({page}) => {
  await ready(page);
  await page.locator('#life-character').click();
  await page.locator('#life-name').fill('風城測試員');
  await page.locator('#life-role').selectOption('worker');
  await page.locator('#life-hairStyle').selectOption('bun');
  await page.locator('#life-face').selectOption('glasses');
  await page.locator('#life-shirt').fill('#882244');
  await expect.poll(async()=>(await snapshot(page)).avatar.config).toMatchObject({name:'風城測試員',role:'worker',hairStyle:'bun',face:'glasses',shirt:'#882244'});
  await page.keyboard.press('Escape');
  await expect(page.locator('#life-character')).toBeFocused();
  await page.reload();
  await expect(page.locator('#life-character')).toBeVisible();
  expect((await snapshot(page)).avatar.config).toMatchObject({name:'風城測試員',role:'worker',hairStyle:'bun',face:'glasses',shirt:'#882244'});
  await page.locator('#life-character').click();
  await page.locator('#life-reset-look').click();
  await expect(page.locator('#life-name')).toHaveValue('我的角色');
});

test('destination movement, pause and camera follow use one live simulation state', async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});
  await ready(page);
  await page.locator('#life-character').click();
  await page.locator('[data-life-tab="trip"]').click();
  await page.locator('#life-destination').selectOption('c12');
  await page.locator('#life-depart').click();
  expect((await snapshot(page)).following).toBe('avatar');
  const initial=(await snapshot(page)).people.find(p=>p.isAvatar).position;
  await page.locator('#pause').click();
  await expect.poll(async()=>JSON.stringify((await snapshot(page)).people.find(p=>p.isAvatar).position)).not.toBe(JSON.stringify(initial));
  await page.locator('#pause').click();
  const paused=await snapshot(page);
  await page.waitForTimeout(250);
  const later=await snapshot(page);
  expect(later.people).toEqual(paused.people);
  expect(later.logs).toEqual(paused.logs);
  await page.locator('#life-stop-follow').click();
  expect((await snapshot(page)).following).toBeNull();
});

test('flows, cargo, journal, photo pose and hidden markers are controllable', async ({page}) => {
  await ready(page);
  await page.locator('#life-flows').click();
  await page.locator('[data-life-flow="f4"]').click();
  await expect(page.locator('#life-flow-detail')).toContainText('非經查證政策關係');
  expect((await snapshot(page)).selectedFlow).toBe('f4');
  expect((await snapshot(page)).flowsVisible).toBe(true);
  await page.locator('#life-flow-visible').click();
  expect((await snapshot(page)).flowsVisible).toBe(false);
  await page.locator('#life-carry-visible').click();
  expect((await snapshot(page)).carryVisible).toBe(false);
  await page.keyboard.press('Escape');
  await page.locator('#life-journal').click();
  await expect(page.locator('#life-stat-people')).toHaveText('28');
  await page.locator('#life-person').selectOption('f4-p1');
  await page.locator('#life-follow-person').click();
  expect((await snapshot(page)).following).toBe('f4-p1');
  await page.locator('#life-character').click();
  await page.locator('[data-life-tab="photo"]').click();
  await page.locator('#life-photo-destination').selectOption('c1');
  await page.locator('#life-pose').selectOption('wave');
  await page.locator('#life-pose-go').click();
  expect((await snapshot(page)).avatar.pose).toBe('wave');
  await page.locator('#life-character').click();
  await page.locator('#life-photo-clean').click();
  await expect(page.locator('.island-label').first()).toBeHidden();
  await expect(page.locator('#life-exit-photo')).toBeVisible();
  await page.locator('#life-exit-photo').click();
  await expect(page.locator('.island-label').first()).toBeVisible();
});

test('mobile map destination selection uses island buttons and supports Escape', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await ready(page);
  await page.locator('#life-character').click();
  await page.locator('[data-life-tab="trip"]').click();
  await page.locator('#life-pick').click();
  await expect(page.locator('#life-cancel-pick')).toBeVisible();
  await page.locator('.island-label[data-category="c12"]').click();
  expect((await snapshot(page)).avatar.target).toBe('c12');
  expect((await snapshot(page)).pickMode).toBe(false);
  expect((await snapshot(page)).following).toBe('avatar');
  await page.keyboard.press('Escape');
  expect((await snapshot(page)).following).toBeNull();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
