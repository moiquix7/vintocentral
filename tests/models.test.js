import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats } from '../js/modules/dashboard/dashboard.stats.js';
import { sanitizeCatalogItem, validateCatalogItem } from '../js/modules/catalogs/catalog.model.js';
import {
  sanitizeNewUser,
  validateNewUser,
  validateProfileChange,
  normalizeUsername,
  validateUsername,
  isEmailIdentifier,
  sanitizeProfileUpdate,
  validateProfileUpdate,
  validatePasswordChange,
} from '../js/modules/users/user.model.js';

const lookups = { categoryName: (id) => `cat-${id}`, locationName: (id) => `loc-${id}` };

test('computeStats totals units, value and attention count', () => {
  const stats = computeStats(
    [
      { categoryId: 'a', locationId: 'x', condition: 'good', quantity: 10, value: 5 },
      { categoryId: 'a', locationId: 'y', condition: 'poor', quantity: 2, value: 100 },
      { categoryId: 'b', locationId: 'x', condition: 'out_of_service', quantity: 1, value: 0 },
    ],
    lookups,
  );
  assert.equal(stats.totalRecords, 3);
  assert.equal(stats.totalUnits, 13);
  assert.equal(stats.totalValue, 250);
  assert.equal(stats.needsAttention, 2);
  assert.deepEqual(stats.byCategory.map((g) => [g.label, g.units]), [['cat-a', 12], ['cat-b', 1]]);
  assert.equal(stats.byCondition.find((c) => c.key === 'good').units, 10);
});

test('computeStats on empty list', () => {
  const stats = computeStats([], lookups);
  assert.equal(stats.totalRecords, 0);
  assert.deepEqual(stats.byCategory, []);
});

test('catalog: whitelist, required name and duplicate detection', () => {
  const item = sanitizeCatalogItem({ name: ' Templo ', description: 'x', extra: 1 });
  assert.deepEqual(item, { name: 'Templo', description: 'x' });
  const existing = [{ id: '1', name: 'TEMPLO' }];
  assert.ok(validateCatalogItem(item, existing).name);
  assert.deepEqual(validateCatalogItem(item, existing, '1'), {});
  assert.ok(validateCatalogItem(sanitizeCatalogItem({ name: '' }), []).name);
});

test('new user validation', () => {
  const user = sanitizeNewUser({ displayName: 'Ana', username: 'Ana', email: ' ANA@Iglesia.org ', role: 'editor', password: '12345678', extra: 1 });
  assert.deepEqual(Object.keys(user).sort(), ['displayName', 'email', 'password', 'role', 'username']);
  assert.equal(user.email, 'ana@iglesia.org');
  assert.equal(user.username, 'ana');
  assert.deepEqual(validateNewUser(user), {});
  const bad = validateNewUser(sanitizeNewUser({ email: 'x', role: 'root', password: '123' }));
  assert.deepEqual(Object.keys(bad).sort(), ['displayName', 'email', 'password', 'role', 'username']);
});

test('usernames are normalized and validated', () => {
  assert.equal(normalizeUsername('  Moisés  Rodríguez '), 'moises.rodriguez');
  assert.equal(validateUsername('moises.rodriguez'), null);
  assert.equal(validateUsername('ana_1-b'), null);
  assert.ok(validateUsername(''));
  assert.ok(validateUsername('ab'));
  assert.ok(validateUsername('x'.repeat(31)));
  assert.ok(validateUsername(normalizeUsername('josé#1')));
  assert.ok(isEmailIdentifier('a@b.com'));
  assert.ok(!isEmailIdentifier('moises'));
});

test('profile update and password change validation', () => {
  const profile = sanitizeProfileUpdate({ displayName: ' Ana ', username: 'Ana Pérez', role: 'admin' });
  assert.deepEqual(profile, { displayName: 'Ana', username: 'ana.perez' });
  assert.deepEqual(validateProfileUpdate(profile), {});
  assert.ok(validateProfileUpdate(sanitizeProfileUpdate({})).displayName);

  assert.deepEqual(validatePasswordChange({ currentPassword: 'old12345', newPassword: 'new12345', confirmPassword: 'new12345' }), {});
  const errors = validatePasswordChange({ currentPassword: '', newPassword: '123', confirmPassword: '124' });
  assert.deepEqual(Object.keys(errors).sort(), ['confirmPassword', 'currentPassword', 'newPassword']);
  assert.ok(validatePasswordChange({ currentPassword: 'same1234', newPassword: 'same1234', confirmPassword: 'same1234' }).newPassword);
});

test('admin cannot lock themselves out', () => {
  assert.ok(validateProfileChange({ targetUid: 'me', currentUid: 'me', role: 'editor', active: true }));
  assert.ok(validateProfileChange({ targetUid: 'me', currentUid: 'me', role: 'admin', active: false }));
  assert.equal(validateProfileChange({ targetUid: 'other', currentUid: 'me', role: 'viewer', active: false }), null);
  assert.ok(validateProfileChange({ targetUid: 'other', currentUid: 'me', role: 'root', active: true }));
});
