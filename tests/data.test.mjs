import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('../src/data.json', import.meta.url), 'utf8'));
const source = await readFile(new URL('../docs/施政成果整理.md', import.meta.url), 'utf8');
const items = data.categories.flatMap(category => category.items);

test('catalog contains 117 uniquely numbered entries across 13 categories', () => {
  assert.equal(data.categories.length, 13);
  assert.equal(new Set(data.categories.map(category => category.id)).size, 13);
  assert.equal(items.length, 117);
  assert.deepEqual(items.map(item => item.id).sort((a, b) => a - b), [...Array.from({ length: 90 }, (_, index) => index + 1), ...Array.from({ length: 27 }, (_, index) => index + 92)]);
  assert.deepEqual(data.categories.map(category => category.items.length), [3, 7, 10, 11, 8, 14, 3, 10, 5, 8, 3, 8, 27]);
});

test('only the eight explicitly pending source entries use the pending status', () => {
  assert.deepEqual(items.filter(item => item.status === 'pending').map(item => item.id), [83, 84, 85, 86, 87, 88, 89, 90]);
  assert.equal(items.filter(item => item.status === 'reported').length, 82);
  assert.ok(items.every(item => ['reported', 'pending', 'completed'].includes(item.status)));
  assert.equal(data.categories[11].title, '推動中或尚未實施項目');
});

test('category placement, titles and full descriptions preserve the supplied source', () => {
  let categoryIndex = -1;
  let verifiedItems = 0;
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = line.match(/^[一二三四五六七八九十]+、(.+)$/);
    if (heading) {
      categoryIndex += 1;
      assert.equal(data.categories[categoryIndex].title, heading[1]);
      continue;
    }
    const numberedLine = line.match(/^(\d+)\.\s*(.*)$/);
    if (!numberedLine || !numberedLine[2]) continue;
    const id = Number(numberedLine[1]);
    const separatorIndex = numberedLine[2].indexOf('：');
    assert.notEqual(separatorIndex, -1, `Source entry ${id} must contain a title separator`);
    const item = data.categories[categoryIndex].items.find(entry => entry.id === id);
    assert.ok(item, `Source entry ${id} must remain in its original category`);
    assert.equal(item.title, numberedLine[2].slice(0, separatorIndex));
    assert.equal(item.description, numberedLine[2].slice(separatorIndex + 1));
    verifiedItems += 1;
  }
  assert.equal(verifiedItems, 90);
  assert.equal(categoryIndex, 11);
});

test('the empty source entry 91 is not represented as content', () => {
  assert.match(source, /^91\.\s*$/m);
  assert.ok(items.every(item => item.id !== 91 && item.title.trim() && item.description.trim()));
});

test('both sides of the two unresolved source discrepancies retain visible review notes', () => {
  for (const id of [3, 22, 84, 86]) {
    const item = items.find(entry => entry.id === id);
    assert.ok(item.note?.trim(), `Entry ${id} requires a review note`);
    assert.match(item.note, /待核對/);
  }
  for (const id of [3, 84]) assert.match(items.find(item => item.id === id).note, /棒球場賽事/);
  for (const id of [22, 86]) assert.match(items.find(item => item.id === id).note, /國中乳品補助/);
});

test('school walkway names preserve the supplemental list and user-confirmed completion', async () => {
  const source = await readFile(new URL('../docs/通學步道.md', import.meta.url), 'utf8');
  const names = source.split(/\r?\n/).slice(2, 29);
  const category = data.categories.find(category => category.id === 'c13');
  assert.equal(category.title, '通學步道');
  assert.equal(names.length, 27);
  assert.deepEqual(category.items.map(item => item.title), names);
  assert.ok(category.items.every(item => item.status === 'completed' && item.confirmedOn === '2026-10-25' && item.source === '通學步道.md'));
  assert.equal(items.filter(item => item.status === 'completed').length, 27);
});
