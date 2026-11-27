import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_FILTERS,
  countUsage,
  filterCatalogItems,
  sortCatalogItems,
} from '../js/modules/catalogs/catalog-filter.js';

const stamp = (ms) => ({ toMillis: () => ms });
const items = [
  { id: 'd1', name: 'Jóvenes', description: 'Ministerio juvenil', leaders: [{ name: 'Joaz Ramos', from: 2026, to: null }], updatedAt: stamp(300) },
  { id: 'd2', name: 'Música', description: '', leaders: [{ name: 'Ana Pérez', from: 2020, to: 2022 }], updatedAt: stamp(100) },
  { id: 'd3', name: 'Escuela Sabática', description: 'Clases', leaders: [], updatedAt: stamp(200) },
];
const assets = [{ categoryId: 'd1' }, { categoryId: 'd1' }, { categoryId: 'd2' }, { categoryId: '' }, {}];
const usage = countUsage(assets, 'categoryId');
const names = (list) => list.map((item) => item.name);

test('countUsage counts articles per record and ignores empty ids', () => {
  assert.deepEqual([...usage.entries()], [['d1', 2], ['d2', 1]]);
});

test('search ignores accents and case, and looks into description and leader names', () => {
  assert.deepEqual(names(filterCatalogItems(items, { ...EMPTY_FILTERS, text: 'MUSICA' }, usage)), ['Música']);
  assert.deepEqual(names(filterCatalogItems(items, { ...EMPTY_FILTERS, text: 'clases' }, usage)), ['Escuela Sabática']);
  assert.deepEqual(names(filterCatalogItems(items, { ...EMPTY_FILTERS, text: 'joaz' }, usage)), ['Jóvenes']);
  assert.deepEqual(filterCatalogItems(items, { ...EMPTY_FILTERS, text: 'nada' }, usage), []);
});

test('usage filter: in use / not used', () => {
  assert.deepEqual(names(filterCatalogItems(items, { ...EMPTY_FILTERS, usage: 'used' }, usage)), ['Jóvenes', 'Música']);
  assert.deepEqual(names(filterCatalogItems(items, { ...EMPTY_FILTERS, usage: 'unused' }, usage)), ['Escuela Sabática']);
});

test('leader filter: with / without a current leader', () => {
  const filters = { ...EMPTY_FILTERS, leader: 'current' };
  assert.deepEqual(names(filterCatalogItems(items, filters, usage, 2026)), ['Jóvenes']);
  assert.deepEqual(names(filterCatalogItems(items, { ...filters, leader: 'none' }, usage, 2026)), ['Música', 'Escuela Sabática']);
});

test('sorting by name, usage and last change; unknown key falls back to name', () => {
  assert.deepEqual(names(sortCatalogItems(items, 'name:asc')), ['Escuela Sabática', 'Jóvenes', 'Música']);
  assert.deepEqual(names(sortCatalogItems(items, 'name:desc')), ['Música', 'Jóvenes', 'Escuela Sabática']);
  assert.deepEqual(names(sortCatalogItems(items, 'usage:desc', usage)), ['Jóvenes', 'Música', 'Escuela Sabática']);
  assert.deepEqual(names(sortCatalogItems(items, 'usage:asc', usage)), ['Escuela Sabática', 'Música', 'Jóvenes']);
  assert.deepEqual(names(sortCatalogItems(items, 'updatedAt:desc')), ['Jóvenes', 'Escuela Sabática', 'Música']);
  assert.deepEqual(names(sortCatalogItems(items, 'bogus')), ['Escuela Sabática', 'Jóvenes', 'Música']);
});

test('sorting does not change the input array', () => {
  const copy = [...items];
  sortCatalogItems(items, 'name:desc');
  assert.deepEqual(items, copy);
});
