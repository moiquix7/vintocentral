import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  diffAssets,
  describeValue,
  sanitizeHistoryEntry,
  sortChronological,
  sortNewestFirst,
  filterHistory,
} from '../js/modules/history/history.model.js';

const lookups = {
  typeName: (id) => ({ t1: 'Mobiliario' })[id] ?? 'Sin tipo',
  categoryName: (id) => ({ c1: 'Música' })[id] ?? 'Sin departamento',
  locationName: (id) => ({ l1: 'Templo', l2: 'Salón de jóvenes' })[id] ?? 'Sin ubicación',
};

const stored = {
  name: 'Silla',
  locationId: 'l1',
  condition: 'good',
  tags: ['templo'],
  quantity: 10,
  photos: [{ path: 'a', url: 'u' }],
  updatedAt: 1,
};

test('diff lists only changed fields, as readable text, in form order', () => {
  const changes = diffAssets(stored, { locationId: 'l2', condition: 'poor', name: 'Silla', quantity: 10 }, lookups);
  assert.deepEqual(changes, [
    { field: 'locationId', from: 'Templo', to: 'Salón de jóvenes' },
    { field: 'condition', from: 'Bueno', to: 'Malo' },
  ]);
});

test('fields absent from the write are unchanged; missing availability counts as available', () => {
  assert.deepEqual(diffAssets(stored, { availability: 'available' }, lookups), []);
  assert.deepEqual(diffAssets(stored, { availability: 'loaned' }, lookups), [{ field: 'availability', from: 'Disponible', to: 'Prestado' }]);
  assert.deepEqual(diffAssets(stored, { updatedAt: 2, checkedAt: 3 }, lookups), []);
});

test('photos are compared by path and described by count; tags joined', () => {
  const swapped = diffAssets(stored, { photos: [{ path: 'b', url: 'v' }] }, lookups);
  assert.deepEqual(swapped, [{ field: 'photos', from: '1 foto', to: '1 foto' }]);
  assert.equal(describeValue('photos', [], lookups), '0 fotos');
  assert.deepEqual(diffAssets(stored, { tags: ['templo', 'donación'] }, lookups), [
    { field: 'tags', from: 'templo', to: 'templo, donación' },
  ]);
});

test('a new article diffs against nothing; long values are cut', () => {
  const changes = diffAssets(null, { description: 'x'.repeat(500) }, lookups);
  assert.equal(changes[0].from, '');
  assert.equal(changes[0].to.length, 200);
});

test('entries keep only whitelisted data', () => {
  const entry = sanitizeHistoryEntry({
    assetId: ' a1 ',
    assetName: '',
    action: 'hack',
    changes: [{ field: 'role', from: 'viewer', to: 'admin' }, { field: 'name', from: 'A', to: 'B', extra: 1 }],
    by: 'u1',
    byName: '',
    isAdmin: true,
  });
  assert.deepEqual(entry, {
    assetId: 'a1',
    assetName: '(sin nombre)',
    action: 'update',
    changes: [{ field: 'name', from: 'A', to: 'B' }],
    by: 'u1',
    byName: 'Usuario',
  });
});

test('sorting and filtering', () => {
  const entries = [
    { id: '1', at: 200, action: 'update', assetName: 'Micrófono', byName: 'Luz Andrea' },
    { id: '2', at: { toMillis: () => 100 }, action: 'create', assetName: 'Banca', byName: 'Pedro' },
    { id: '3', at: null, action: 'check', assetName: 'Silla', byName: 'Luz Andrea' },
  ];
  assert.deepEqual(sortChronological(entries).map((e) => e.id), ['3', '2', '1']);
  assert.deepEqual(sortNewestFirst(entries).map((e) => e.id), ['1', '2', '3']);
  assert.deepEqual(filterHistory(entries, { text: 'microfono' }).map((e) => e.id), ['1']);
  assert.deepEqual(filterHistory(entries, { text: 'luz' }).map((e) => e.id), ['1', '3']);
  assert.deepEqual(filterHistory(entries, { action: 'create' }).map((e) => e.id), ['2']);
});

test('history: new fields; a missing switch (old article) equals "No"', () => {
  assert.deepEqual(diffAssets(stored, { builtIn: false, insured: false, brand: '' }, lookups), []);
  assert.deepEqual(diffAssets(stored, { insured: true, brand: 'Yamaha' }, lookups), [
    { field: 'brand', from: '', to: 'Yamaha' },
    { field: 'insured', from: 'No', to: 'Sí' },
  ]);
});

test('undo verification: described as one explicit change, never by the automatic diff', async () => {
  const { uncheckChange, sanitizeHistoryEntry, HISTORY_ACTIONS } = await import('../js/modules/history/history.model.js');
  const change = uncheckChange({ checkedAt: new Date(2026, 10, 20, 10, 15) });
  assert.equal(change.field, 'checkedAt');
  assert.equal(change.to, 'Sin verificar');
  assert.notEqual(change.from, 'Sin verificar');
  assert.equal(uncheckChange({}).from, 'Sin verificar');
  assert.equal(HISTORY_ACTIONS.uncheck, 'Deshizo la verificación');
  const entry = sanitizeHistoryEntry({ assetId: 'a', assetName: 'Silla', action: 'uncheck', changes: [change], by: 'u', byName: 'Luz' });
  assert.equal(entry.action, 'uncheck');
  assert.deepEqual(entry.changes, [change], 'checkedAt is an accepted history field');
  assert.deepEqual(diffAssets({ checkedAt: new Date() }, { checkedAt: null }, lookups), []);
});
