import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountInputValue, formatCurrency } from '../js/shared/format.js';
import { hasAtMostTwoDecimals } from '../js/shared/validation.js';
import { sanitizeAsset, validateAsset } from '../js/modules/assets/asset.model.js';

test('amounts read "Bs." + two decimals (CLAUDE.md CURRENCY)', () => {
  assert.equal(formatCurrency(100), 'Bs. 100.00');
  assert.equal(formatCurrency(1250.5), 'Bs. 1,250.50');
  assert.equal(formatCurrency(0), 'Bs. 0.00');
  assert.equal(formatCurrency(0.1 + 0.2), 'Bs. 0.30');
  assert.equal(formatCurrency(undefined), '—');
  assert.equal(formatCurrency(Number.NaN), '—');
});

test('amount input value always has two decimals', () => {
  assert.equal(amountInputValue(150), '150.00');
  assert.equal(amountInputValue(150.5), '150.50');
  assert.equal(amountInputValue(undefined), '');
});

test('two-decimal check tolerates float noise and rejects a third decimal', () => {
  assert.equal(hasAtMostTwoDecimals(100), true);
  assert.equal(hasAtMostTwoDecimals(0.1 + 0.2), true);
  assert.equal(hasAtMostTwoDecimals(19.99), true);
  assert.equal(hasAtMostTwoDecimals(10.555), false);
  assert.equal(hasAtMostTwoDecimals(Number.NaN), false);
});

test('asset value: comma or point accepted, more than two decimals refused', () => {
  const base = { name: 'Silla', typeId: 't', categoryId: 'c', locationId: 'l', condition: 'good', availability: 'available', quantity: '1' };
  assert.equal(sanitizeAsset({ ...base, value: '150,50' }).value, 150.5);
  assert.equal(validateAsset(sanitizeAsset({ ...base, value: '150.50' })).value, undefined);
  assert.match(validateAsset(sanitizeAsset({ ...base, value: '150.555' })).value, /dos decimales/);
  assert.ok(validateAsset(sanitizeAsset({ ...base, value: '-1' })).value);
});
