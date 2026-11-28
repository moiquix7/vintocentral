import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRoundStart,
  isChecked,
  filterByCheck,
  inventoryProgress,
  storedStatus,
  sameStatus,
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

test('rows edited since the filters changed stay listed', () => {
  const keep = new Set(['1']);
  const pending = filterByCheck(assets, 'pending', '2026-01-01', keep).map((a) => a.id);
  assert.ok(pending.includes('1'));
});

test('row changes are detected against the stored values (old articles: available)', () => {
  const same = { locationId: 'l1', condition: 'good', availability: 'available', unavailableReason: '', notes: '', proposedAction: '', proposedActionNote: '' };
  assert.deepEqual(storedStatus(assets[0]), same);
  assert.equal(sameStatus(storedStatus(assets[0]), same), true);
  assert.equal(sameStatus(storedStatus(assets[0]), { ...same, locationId: 'l2' }), false);
  assert.equal(sameStatus(storedStatus(assets[0]), { ...same, availability: 'missing' }), false);
  assert.equal(sameStatus(storedStatus(assets[0]), { ...same, notes: 'Pata floja' }), false);
  assert.equal(sameStatus(storedStatus(assets[0]), { ...same, proposedAction: 'repair' }), false);
  assert.equal(storedStatus({ ...assets[0], proposedAction: 'unknown' }).proposedAction, '');
  assert.equal(sameStatus({ locationId: 'l1' }, { locationId: 'l1', notes: '' }), true);
  // A stale reason on an available article is not part of its status.
  assert.equal(storedStatus({ ...assets[0], availability: 'in_use', unavailableReason: 'x' }).unavailableReason, '');
});

test('modo fácil: pending articles of a location, by name; pending count per location', async () => {
  const { easyQueue, pendingByLocation } = await import('../js/modules/inventory/inventory.model.js');
  const list = [
    { id: 'a', name: 'Mesa', locationId: 'l1' },
    { id: 'b', name: 'Atril', locationId: 'l1' },
    { id: 'c', name: 'Banca', locationId: 'l1', checkedAt: at(2026, 3, 2) },
    { id: 'd', name: 'Piano', locationId: 'l2' },
  ];
  assert.deepEqual(easyQueue(list, 'l1', '2026-03-01').map((x) => x.id), ['b', 'a']);
  assert.deepEqual(easyQueue(list, '', '2026-03-01').map((x) => x.id), ['b', 'a', 'd']);
  assert.deepEqual([...pendingByLocation(list, '2026-03-01')], [['l1', 2], ['l2', 1]]);
});
