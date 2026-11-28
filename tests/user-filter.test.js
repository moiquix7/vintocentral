import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_USER_FILTERS, filterUsers, sortUsers, isActiveUser } from '../js/modules/users/user-filter.js';
import { normalizePhone, validatePhone, validateEmailChange } from '../js/modules/users/user.model.js';

const users = [
  { uid: '1', displayName: 'Luz Andrea', username: 'luz.andrea', email: 'luz@correo.com', role: 'admin', active: true },
  { uid: '2', displayName: 'Óscar Pérez', username: 'oscar', email: 'oscar@correo.com', role: 'viewer', active: false },
  { uid: '3', displayName: 'Ana', username: '', email: 'ana@correo.com', role: 'editor', active: true },
];
const ids = (list) => list.map((user) => user.uid);

test('user search covers name, username and email, ignoring accents and case', () => {
  assert.deepEqual(ids(filterUsers(users, { ...EMPTY_USER_FILTERS, text: 'oscar' })), ['2']);
  assert.deepEqual(ids(filterUsers(users, { ...EMPTY_USER_FILTERS, text: 'LUZ.ANDREA' })), ['1']);
  assert.deepEqual(ids(filterUsers(users, { ...EMPTY_USER_FILTERS, text: 'ana@' })), ['3']);
});

test('user filters: role and status (only active === true is active)', () => {
  assert.deepEqual(ids(filterUsers(users, { ...EMPTY_USER_FILTERS, role: 'editor' })), ['3']);
  assert.deepEqual(ids(filterUsers(users, { ...EMPTY_USER_FILTERS, status: 'inactive' })), ['2']);
  assert.deepEqual(ids(filterUsers(users, { ...EMPTY_USER_FILTERS, status: 'active' })), ['1', '3']);
  assert.equal(isActiveUser({ active: 'true' }), false);
});

test('user sorting', () => {
  assert.deepEqual(ids(sortUsers(users, 'name:asc')), ['3', '1', '2']);
  assert.deepEqual(ids(sortUsers(users, 'name:desc')), ['2', '1', '3']);
  assert.deepEqual(ids(sortUsers(users, 'role:asc')), ['1', '3', '2']);
  assert.deepEqual(ids(sortUsers(users, 'status:asc')), ['3', '1', '2']);
  assert.deepEqual(ids(sortUsers(users, 'username:asc')), ['1', '2', '3'], 'without username goes last');
  assert.deepEqual(ids(sortUsers(users, 'bogus')), ['3', '1', '2']);
  assert.notEqual(sortUsers(users, 'name:asc'), users, 'returns a new array');
});

test('phone: optional, digits and + - ( ) only, at least 7 digits', () => {
  assert.equal(normalizePhone('  +591   700 12345 '), '+591 700 12345');
  assert.equal(validatePhone(''), null);
  assert.equal(validatePhone('+591 (4) 700-1234'), null);
  assert.ok(validatePhone('70a12345'));
  assert.ok(validatePhone('12345'));
});

test('email change needs a different valid email and the current password', () => {
  const ok = validateEmailChange({ newEmail: ' Nuevo@Correo.com ', currentEmail: 'luz@correo.com', currentPassword: 'x' });
  assert.equal(ok.email, 'nuevo@correo.com');
  assert.deepEqual(ok.errors, {});
  assert.ok(validateEmailChange({ newEmail: 'LUZ@correo.com', currentEmail: 'luz@correo.com', currentPassword: 'x' }).errors.newEmail);
  assert.ok(validateEmailChange({ newEmail: 'no-es-correo', currentEmail: 'a@b.co', currentPassword: 'x' }).errors.newEmail);
  assert.ok(validateEmailChange({ newEmail: 'n@b.co', currentEmail: 'a@b.co', currentPassword: '' }).errors.emailPassword);
});
