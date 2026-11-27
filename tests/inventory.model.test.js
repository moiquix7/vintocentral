import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRoundStart,
  isChecked,
  filterByCheck,
  inventoryProgress,
  sortForWalk,
  storedStatus,
  hasChanges,
} from '../js/modules/inventory/inventory.model.js';

/** Minimal Firestore Timestamp stand-in. */
const at = (year, month, day, hour = 12) => ({ toMillis: () => new Date(year, month - 1, day, hour).getTime() });

const assets = [
  { id: '1', name: 'Silla', locationId: 'l1', condition: 'good', checkedAt: at(2026, 3, 1) },
  { id: '2', name: 'Banca', locationId: 'l1', condition: 'fair', checkedAt: at(2026, 2, 28, 23) },
  { id: '3', name: 'Micrófono', locationId: 'l2', condition: 'good' },
];

test('round start: real past dates are kept, anything else becomes today', () => {
  assert.equal(normalizeRoundStart('2026-03-01', '2026-11-26'), '2026-03-01');
  assert.equal(normalizeRoundStart('2026-11-26', '2026-11-26'), '2026-11-26');
  assert.equal(normalizeRoundStart('2026-12-01', '2026-11-26'), '2026-11-26');
  assert.equal(normalizeRoundStart('2026-02-30', '2026-11-26'), '2026-11-26');
  assert.equal(normalizeRoundStart(null, '2026-11-26'), '2026-11-26');
});

test('verified means checked on or after the start of the round day', () => {
  assert.equal(isChecked(assets[0], '2026-03-01'), true);
  assert.equal(isChecked(assets[1], '2026-03-01'), false); // the evening before
  assert.equal(isChecked(assets[2], '2026-03-01'), false); // never checked
  assert.equal(isChecked({ checkedAt: new Date(2026, 2, 1, 0, 0) }, '2026-03-01'), true);
  assert.equal(isChecked({ checkedAt: null }, '2026-03-01'), false);
});

test('pending / checked / all filters and progress', () => {
  const ids = (status) => filterByCheck(assets, status, '2026-03-01').map((a) => a.id);
  assert.deepEqual(ids('checked'), ['1']);
  assert.deepEqual(ids('pending'), ['2', '3']);
  assert.deepEqual(ids('all'), ['1', '2', '3']);
  assert.deepEqual(inventoryProgress(assets, '2026-03-01'), { checked: 1, total: 3, percent: 33 });
  assert.deepEqual(inventoryProgress(assets, '2026-01-01'), { checked: 2, total: 3, percent: 66 });
  assert.deepEqual(inventoryProgress([], '2026-01-01'), { checked: 0, total: 0, percent: 0 });
});

test('walking order: by location name, then article name, without mutating input', () => {
  const names = { l1: 'Templo', l2: 'Salón de jóvenes' };
  assert.deepEqual(sortForWalk(assets, (id) => names[id]).map((a) => a.id), ['3', '2', '1']);
  assert.deepEqual(assets.map((a) => a.id), ['1', '2', '3']);
});

test('row changes are detected against the stored values (old articles: available)', () => {
  assert.deepEqual(storedStatus(assets[0]), { locationId: 'l1', condition: 'good', availability: 'available' });
  assert.equal(hasChanges(assets[0], { locationId: 'l1', condition: 'good', availability: 'available' }), false);
  assert.equal(hasChanges(assets[0], { locationId: 'l2', condition: 'good', availability: 'available' }), true);
  assert.equal(hasChanges(assets[0], { locationId: 'l1', condition: 'good', availability: 'missing' }), true);
});
