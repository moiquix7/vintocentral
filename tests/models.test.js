import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats } from '../js/modules/dashboard/dashboard.stats.js';
import { percentOf } from '../js/shared/format.js';
import {
  sanitizeCatalogItem,
  validateCatalogItem,
  sanitizeLeaders,
  validateLeaders,
  sortLeaders,
  yearOptions,
  currentLeaders,
  periodText,
  leadersOf,
} from '../js/modules/catalogs/catalog.model.js';
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

const lookups = { typeName: (id) => `type-${id}`, categoryName: (id) => `cat-${id}`, locationName: (id) => `loc-${id}` };

test('computeStats totals units, value and attention count', () => {
  const stats = computeStats(
    [
      { typeId: 't', categoryId: 'a', locationId: 'x', condition: 'good', quantity: 10, value: 5 },
      { typeId: 't', categoryId: 'a', locationId: 'y', condition: 'poor', availability: 'in_repair', quantity: 2, value: 100 },
      { categoryId: 'b', locationId: 'x', condition: 'out_of_service', availability: 'missing', quantity: 1, value: 0 },
    ],
    lookups,
  );
  assert.equal(stats.totalRecords, 3);
  assert.equal(stats.totalUnits, 13);
  assert.equal(stats.totalValue, 250);
  assert.equal(stats.needsAttention, 2);
  assert.deepEqual(stats.byCategory.map((g) => [g.label, g.units]), [['cat-a', 12], ['cat-b', 1]]);
  assert.equal(stats.byCondition.find((c) => c.key === 'good').units, 10);
  assert.deepEqual(stats.byType.map((g) => [g.label, g.units]), [['type-t', 12], ['type-', 1]]);
  assert.deepEqual(
    stats.byAvailability.filter((g) => g.units).map((g) => [g.key, g.units]),
    [['available', 10], ['in_repair', 2], ['missing', 1]],
  );
});

test('needs attention: bad condition, under repair or missing (counted once per article)', () => {
  const stats = computeStats(
    [
      { categoryId: 'a', locationId: 'x', condition: 'good', availability: 'missing' },
      { categoryId: 'a', locationId: 'x', condition: 'new', availability: 'in_repair' },
      { categoryId: 'a', locationId: 'x', condition: 'fair', availability: 'loaned' },
      { categoryId: 'a', locationId: 'x', condition: 'poor', availability: 'missing' },
    ],
    lookups,
  );
  assert.equal(stats.needsAttention, 3);
  assert.equal(percentOf(1, 3), 33);
  assert.equal(percentOf(5, 0), 0);
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

test('departments keep a leader history; locations never get one', () => {
  const department = sanitizeCatalogItem(
    {
      name: 'JA',
      leaders: [
        { name: '  Ana  Rojas ', from: '2023', to: '2024', extra: 1 },
        { name: '', from: '', to: '' }, // empty row from the form: dropped
        { name: 'Juan Pérez', from: '2025', to: '' },
      ],
      extra: 1,
    },
    { withLeader: true },
  );
  assert.deepEqual(department.leaders, [
    { name: 'Ana Rojas', from: 2023, to: 2024 },
    { name: 'Juan Pérez', from: 2025, to: null },
  ]);
  assert.deepEqual(validateCatalogItem(department, [], null, 2026), {});
  assert.deepEqual(sortLeaders(department.leaders).map((l) => l.name), ['Juan Pérez', 'Ana Rojas']);

  const location = sanitizeCatalogItem({ name: 'Templo', leaders: [{ name: 'x', from: 2020 }] });
  assert.deepEqual(Object.keys(location).sort(), ['description', 'name']);

  assert.deepEqual(sanitizeCatalogItem({ name: 'Música' }, { withLeader: true }).leaders, []);
  const many = Array.from({ length: 40 }, (_, i) => ({ name: `L${i}`, from: 2000 }));
  assert.equal(sanitizeLeaders(many).length, 30);
  assert.equal(sanitizeLeaders([{ name: 'a'.repeat(200), from: 2020 }])[0].name.length, 80);
});

test('leader validation messages point to the row on screen', () => {
  const check = (leaders) => validateLeaders(sanitizeLeaders(leaders), 2026);
  assert.equal(check([{ name: 'A', from: 2026, to: 2026 }]), null);
  assert.equal(check([{ name: 'A', from: 2027, to: '' }]), null); // next year allowed
  assert.match(check([{ name: 'A', from: 2020 }, { name: '', from: 2021 }]), /^Líder 2: .*nombre/);
  assert.match(check([{ name: 'A', from: '' }]), /año de inicio/);
  assert.match(check([{ name: 'A', from: 2024, to: 2022 }]), /mayor/);
  assert.match(check([{ name: 'A', from: 1900 }]), /no es válido/);
  assert.match(check([{ name: 'A', from: 2030 }]), /no es válido/);
  const errors = validateCatalogItem(sanitizeCatalogItem({ name: 'JA', leaders: [{ name: 'X', from: 'abc' }] }, { withLeader: true }), [], null, 2026);
  assert.ok(errors.leaders);
});

test('year options, current leaders, period text and legacy fields', () => {
  const years = yearOptions(2026);
  assert.equal(years[0], 2027);
  assert.equal(years.at(-1), 1950);
  assert.deepEqual(
    currentLeaders([{ name: 'A', from: 2020, to: 2022 }, { name: 'B', from: 2023, to: null }, { name: 'C', from: 2026, to: 2026 }], 2026).map((l) => l.name),
    ['B', 'C'],
  );
  assert.equal(periodText({ from: 2026, to: 2026 }), '2026');
  assert.equal(periodText({ from: 2024, to: 2025 }), '2024 – 2025');
  assert.equal(periodText({ from: 2024, to: null }), '2024 – actualidad');
  assert.deepEqual(leadersOf({ leader: 'Ana', term: '2025-2026' }), [{ name: 'Ana', from: 2025, to: 2026 }]);
  assert.deepEqual(leadersOf({ leader: 'Ana', term: '2026' }), [{ name: 'Ana', from: 2026, to: 2026 }]);
  assert.deepEqual(leadersOf({ name: 'Sin líder' }), []);
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
