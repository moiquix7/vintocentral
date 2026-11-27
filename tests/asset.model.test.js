import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeAsset,
  validateAsset,
  normalizeTags,
  sanitizePhotos,
  availabilityOf,
  sanitizeInventoryUpdate,
  validateInventoryUpdate,
  ASSET_FIELDS,
  INVENTORY_FIELDS,
  findDuplicateAsset,
  findSimilarAssets,
} from '../js/modules/assets/asset.model.js';

const valid = {
  name: ' Silla plástica ',
  code: 'SILLA-001',
  description: 'Blanca',
  typeId: 'type1',
  categoryId: 'cat1',
  locationId: 'loc1',
  condition: 'good',
  availability: 'in_use',
  tags: 'Templo, templo,  Donación ',
  acquisitionDate: '2020-05-01',
  value: '25,50',
  quantity: '40',
};

test('sanitizeAsset keeps only whitelisted fields (no excess data)', () => {
  const clean = sanitizeAsset({ ...valid, isAdmin: true, photos: ['x'], createdBy: 'hacker' });
  assert.deepEqual(Object.keys(clean).sort(), [...ASSET_FIELDS].sort());
  assert.equal(clean.name, 'Silla plástica');
  assert.equal(clean.value, 25.5);
  assert.equal(clean.quantity, 40);
  assert.deepEqual(clean.tags, ['templo', 'donación']);
});

test('valid asset has no errors', () => {
  assert.deepEqual(validateAsset(sanitizeAsset(valid)), {});
});

test('empty optional numbers get defaults', () => {
  const clean = sanitizeAsset({ ...valid, value: '', quantity: '' });
  assert.equal(clean.value, 0);
  assert.equal(clean.quantity, 1);
});

test('required fields and ranges are validated', () => {
  const errors = validateAsset(
    sanitizeAsset({ name: '  ', condition: 'broken', quantity: '1.5', value: '-3', acquisitionDate: '2023-02-30' }),
  );
  assert.deepEqual(Object.keys(errors).sort(), [
    'acquisitionDate', 'availability', 'categoryId', 'condition', 'locationId', 'name', 'quantity', 'typeId', 'value',
  ]);
});

test('future acquisition date is rejected', () => {
  const errors = validateAsset(sanitizeAsset({ ...valid, acquisitionDate: '2999-01-01' }));
  assert.ok(errors.acquisitionDate);
});

test('long strings are truncated to their limit', () => {
  const clean = sanitizeAsset({ ...valid, name: 'x'.repeat(500), code: 'y'.repeat(100) });
  assert.equal(clean.name.length, 120);
  assert.equal(clean.code.length, 30);
});

test('normalizeTags limits count and length', () => {
  const tags = normalizeTags(Array.from({ length: 20 }, (_, i) => `tag${i}`));
  assert.equal(tags.length, 10);
  assert.equal(normalizeTags(['a'.repeat(80)])[0].length, 30);
});

test('sanitizePhotos keeps only path/url pairs, max 4', () => {
  const photos = sanitizePhotos([
    { path: 'p1', url: 'u1', extra: 1 },
    { path: 'p2' },
    'x',
    { path: 'p3', url: 'u3' },
    { path: 'p4', url: 'u4' },
    { path: 'p5', url: 'u5' },
    { path: 'p6', url: 'u6' },
  ]);
  assert.deepEqual(photos, [
    { path: 'p1', url: 'u1' },
    { path: 'p3', url: 'u3' },
    { path: 'p4', url: 'u4' },
    { path: 'p5', url: 'u5' },
  ]);
});

test('availability: unknown or missing (old articles) counts as available', () => {
  assert.equal(availabilityOf({ availability: 'loaned' }), 'loaned');
  assert.equal(availabilityOf({}), 'available');
  assert.equal(availabilityOf({ availability: 'stolen' }), 'available');
  assert.equal(availabilityOf(null), 'available');
});

test('inventory update keeps only the inventory fields', () => {
  const update = sanitizeInventoryUpdate({ locationId: ' loc2 ', condition: 'fair', availability: 'missing', name: 'x', checkedAt: 1 });
  assert.deepEqual(Object.keys(update).sort(), [...INVENTORY_FIELDS].sort());
  assert.equal(update.locationId, 'loc2');
  assert.deepEqual(validateInventoryUpdate(update), {});
  const errors = validateInventoryUpdate(sanitizeInventoryUpdate({ condition: 'broken', availability: 'lost' }));
  assert.deepEqual(Object.keys(errors).sort(), ['availability', 'condition', 'locationId']);
});

test('the unavailable reason is kept only while the article is not available; notes are limited', () => {
  const loaned = sanitizeInventoryUpdate({ locationId: 'l', condition: 'good', availability: 'loaned', unavailableReason: '  Prestado a  Juan ', notes: 'ok' });
  assert.equal(loaned.unavailableReason, 'Prestado a Juan');
  assert.equal(loaned.notes, 'ok');
  const back = sanitizeInventoryUpdate({ locationId: 'l', condition: 'good', availability: 'available', unavailableReason: 'Prestado' });
  assert.equal(back.unavailableReason, '');
  assert.equal(sanitizeAsset({ ...valid, availability: 'in_use', unavailableReason: 'x' }).unavailableReason, '');
  assert.equal(sanitizeAsset({ ...valid, notes: 'a'.repeat(900) }).notes.length, 500);
  assert.equal(sanitizeAsset({ ...valid, availability: 'missing', unavailableReason: 'b'.repeat(900) }).unavailableReason.length, 200);
  assert.equal(sanitizeAsset({ ...valid, notes: 42 }).notes, '');
});

test('new fields: brand, model and serial are trimmed and limited; switches are strict booleans', () => {
  const clean = sanitizeAsset({ ...valid, brand: ' Yamaha ', model: 'M'.repeat(99), serialNumber: ' SN-1 ', builtIn: true, insured: 'true' });
  assert.equal(clean.brand, 'Yamaha');
  assert.equal(clean.model.length, 60);
  assert.equal(clean.serialNumber, 'SN-1');
  assert.equal(clean.builtIn, true);
  assert.equal(clean.insured, false, 'only a real true counts (no excess data)');
  const old = sanitizeAsset(valid);
  assert.equal(old.builtIn, false);
  assert.equal(old.brand, '');
});

const existing = [
  { id: 'a1', name: 'Silla plástica', locationId: 'templo' },
  { id: 'a2', name: 'Silla de madera', locationId: 'salon' },
  { id: 'a3', name: 'Mesa plegable', locationId: 'templo' },
];

test('findDuplicateAsset: same name (no case/accents/extra spaces) in the same location', () => {
  assert.equal(findDuplicateAsset(existing, { name: '  SILLA   plastica ', locationId: 'templo' })?.id, 'a1');
  assert.equal(findDuplicateAsset(existing, { name: 'Silla plástica', locationId: 'salon' }), null, 'other location is allowed');
  assert.equal(findDuplicateAsset(existing, { name: 'Silla plástica', locationId: 'templo' }, 'a1'), null, 'editing itself is not a duplicate');
  assert.equal(findDuplicateAsset(existing, { name: '', locationId: 'templo' }), null);
});

test('findSimilarAssets: every typed word, exact match first, limited, needs 2+ characters', () => {
  assert.deepEqual(findSimilarAssets(existing, 'silla').map((a) => a.id), ['a2', 'a1']);
  assert.deepEqual(findSimilarAssets([...existing, { id: 'a4', name: 'Silla', locationId: 'x' }], 'SILLA').map((a) => a.id)[0], 'a4');
  assert.deepEqual(findSimilarAssets(existing, 'plas sil').map((a) => a.id), ['a1']);
  assert.deepEqual(findSimilarAssets(existing, 's'), []);
  assert.equal(findSimilarAssets(existing, 'silla', { limit: 1 }).length, 1);
  assert.deepEqual(findSimilarAssets(existing, 'silla', { excludeId: 'a1' }).map((a) => a.id), ['a2']);
});
