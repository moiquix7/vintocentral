import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_FILTERS, filterAssets, sortAssets } from '../js/modules/assets/asset-filter.js';

const lookups = {
  typeName: (id) => ({ t1: 'Mobiliario', t2: 'Equipo de sonido' })[id] ?? 'Sin tipo',
  categoryName: (id) => ({ c1: 'Escuela Sabática', c2: 'Música' })[id] ?? 'Sin departamento',
  locationName: (id) => ({ l1: 'Templo', l2: 'Salón de jóvenes' })[id] ?? 'Sin ubicación',
};

const assets = [
  { id: '1', name: 'Silla', code: 'S-1', typeId: 't1', categoryId: 'c1', locationId: 'l1', condition: 'good', value: 20, tags: ['plástico'] },
  { id: '2', name: 'Micrófono', code: 'M-1', typeId: 't2', categoryId: 'c2', locationId: 'l2', condition: 'poor', availability: 'loaned', value: 300, tags: [] },
  { id: '3', name: 'Banca', code: 'B-1', typeId: 't1', categoryId: 'c1', locationId: 'l2', condition: 'fair', availability: 'in_use', value: 150, tags: [] },
];

test('no filters returns everything', () => {
  assert.equal(filterAssets(assets, EMPTY_FILTERS, lookups).length, 3);
});

test('text search ignores accents and matches category/department/location names and tags', () => {
  const ids = (text) => filterAssets(assets, { ...EMPTY_FILTERS, text }, lookups).map((a) => a.id);
  assert.deepEqual(ids('microfono'), ['2']);
  assert.deepEqual(ids('jovenes'), ['2', '3']);
  assert.deepEqual(ids('plastico'), ['1']);
  assert.deepEqual(ids('mobiliario jovenes'), ['3']);
  assert.deepEqual(ids('musica'), ['2']);
  assert.deepEqual(ids('prestado'), ['2']);
});

test('select filters combine', () => {
  const result = filterAssets(assets, { ...EMPTY_FILTERS, categoryId: 'c1', locationId: 'l2' }, lookups);
  assert.deepEqual(result.map((a) => a.id), ['3']);
  assert.deepEqual(filterAssets(assets, { ...EMPTY_FILTERS, condition: 'poor' }, lookups).map((a) => a.id), ['2']);
  assert.deepEqual(filterAssets(assets, { ...EMPTY_FILTERS, typeId: 't1' }, lookups).map((a) => a.id), ['1', '3']);
  // Article 1 has no availability (registered before the field existed): it counts as available.
  assert.deepEqual(filterAssets(assets, { ...EMPTY_FILTERS, availability: 'available' }, lookups).map((a) => a.id), ['1']);
});

test('sorting by name and value, without mutating input', () => {
  assert.deepEqual(sortAssets(assets, 'name:asc').map((a) => a.id), ['3', '2', '1']);
  assert.deepEqual(sortAssets(assets, 'value:desc').map((a) => a.id), ['2', '3', '1']);
  assert.deepEqual(assets.map((a) => a.id), ['1', '2', '3']);
});

test('unknown sort key falls back to name ascending', () => {
  assert.deepEqual(sortAssets(assets, 'hack:asc').map((a) => a.id), ['3', '2', '1']);
});

test('sorting by catalog names, condition and availability; ties by name', () => {
  const ids = (key) => sortAssets(assets, key, lookups).map((a) => a.id);
  assert.deepEqual(ids('location:asc'), ['3', '2', '1']); // Salón de jóvenes (Banca, Micrófono), Templo
  assert.deepEqual(ids('type:asc'), ['2', '3', '1']); // Equipo de sonido, Mobiliario (Banca, Silla)
  assert.deepEqual(ids('category:asc'), ['3', '1', '2']); // Escuela Sabática (Banca, Silla), Música
  assert.deepEqual(ids('condition:asc'), ['1', '3', '2']); // good, fair, poor
  assert.deepEqual(ids('condition:desc'), ['2', '3', '1']);
  assert.deepEqual(ids('availability:asc'), ['1', '3', '2']); // available (missing field), in_use, loaned
});
