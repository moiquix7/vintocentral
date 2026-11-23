import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeAsset, validateAsset, normalizeTags, sanitizePhotos, ASSET_FIELDS } from '../js/modules/assets/asset.model.js';

const valid = {
  name: ' Silla plástica ',
  code: 'SILLA-001',
  description: 'Blanca',
  categoryId: 'cat1',
  locationId: 'loc1',
  condition: 'good',
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
  assert.deepEqual(Object.keys(errors).sort(), ['acquisitionDate', 'categoryId', 'condition', 'locationId', 'name', 'quantity', 'value']);
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
