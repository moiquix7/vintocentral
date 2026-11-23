import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_FILTERS, filterAssets, sortAssets } from '../js/modules/assets/asset-filter.js';

const lookups = {
  categoryName: (id) => ({ c1: 'Mobiliario', c2: 'Sonido' })[id] ?? 'Sin categoría',
  locationName: (id) => ({ l1: 'Templo', l2: 'Salón de jóvenes' })[id] ?? 'Sin ubicación',
};

const assets = [
  { id: '1', name: 'Silla', code: 'S-1', categoryId: 'c1', locationId: 'l1', condition: 'good', value: 20, tags: ['plástico'] },
  { id: '2', name: 'Micrófono', code: 'M-1', categoryId: 'c2', locationId: 'l2', condition: 'poor', value: 300, tags: [] },
  { id: '3', name: 'Banca', code: 'B-1', categoryId: 'c1', locationId: 'l2', condition: 'fair', value: 150, tags: [] },
];

test('no filters returns everything', () => {
  assert.equal(filterAssets(assets, EMPTY_FILTERS, lookups).length, 3);
});

test('text search ignores accents and matches category/location names and tags', () => {
  const ids = (text) => filterAssets(assets, { ...EMPTY_FILTERS, text }, lookups).map((a) => a.id);
  assert.deepEqual(ids('microfono'), ['2']);
  assert.deepEqual(ids('jovenes'), ['2', '3']);
  assert.deepEqual(ids('plastico'), ['1']);
  assert.deepEqual(ids('mobiliario jovenes'), ['3']);
});

test('select filters combine', () => {
  const result = filterAssets(assets, { ...EMPTY_FILTERS, categoryId: 'c1', locationId: 'l2' }, lookups);
  assert.deepEqual(result.map((a) => a.id), ['3']);
  assert.deepEqual(filterAssets(assets, { ...EMPTY_FILTERS, condition: 'poor' }, lookups).map((a) => a.id), ['2']);
});

test('sorting by name and value, without mutating input', () => {
  assert.deepEqual(sortAssets(assets, 'name:asc').map((a) => a.id), ['3', '2', '1']);
  assert.deepEqual(sortAssets(assets, 'value:desc').map((a) => a.id), ['2', '3', '1']);
  assert.deepEqual(assets.map((a) => a.id), ['1', '2', '3']);
});

test('unknown sort key falls back to name ascending', () => {
  assert.deepEqual(sortAssets(assets, 'hack:asc').map((a) => a.id), ['3', '2', '1']);
});
