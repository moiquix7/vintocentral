import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, cleanMultiline, toNumber, isValidEmail, isIsoDate, foldText } from '../js/shared/validation.js';
import { isFirebaseConfigured } from '../js/core/config-check.js';

test('cleanText collapses spaces, trims and truncates', () => {
  assert.equal(cleanText('  Silla   blanca \n ', 50), 'Silla blanca');
  assert.equal(cleanText('abcdef', 3), 'abc');
  assert.equal(cleanText(42, 10), '');
  assert.equal(cleanText(undefined, 10), '');
});

test('cleanMultiline keeps line breaks but not excess blank lines', () => {
  assert.equal(cleanMultiline('a  b\r\n\n\n\nc ', 100), 'a b\n\nc');
});

test('toNumber accepts dot or comma decimals and flags garbage', () => {
  assert.equal(toNumber('1234.5'), 1234.5);
  assert.equal(toNumber('1234,5'), 1234.5);
  assert.equal(toNumber(7), 7);
  assert.equal(toNumber(''), null);
  assert.ok(Number.isNaN(toNumber('12abc')));
});

test('isValidEmail', () => {
  assert.ok(isValidEmail('ana@iglesia.org'));
  assert.ok(!isValidEmail('ana@iglesia'));
  assert.ok(!isValidEmail('ana iglesia.org'));
});

test('isIsoDate rejects impossible dates', () => {
  assert.ok(isIsoDate('2024-02-29'));
  assert.ok(!isIsoDate('2023-02-29'));
  assert.ok(!isIsoDate('2024-13-01'));
  assert.ok(!isIsoDate('01/02/2024'));
});

test('foldText removes accents and case', () => {
  assert.equal(foldText('  Ubicación  '), 'ubicacion');
});

test('isFirebaseConfigured detects placeholders', () => {
  const complete = { apiKey: 'k', authDomain: 'd', projectId: 'p', storageBucket: 's', messagingSenderId: 'm', appId: 'a' };
  assert.ok(isFirebaseConfigured(complete));
  assert.ok(!isFirebaseConfigured({ ...complete, apiKey: 'REPLACE_WITH_API_KEY' }));
  assert.ok(!isFirebaseConfigured({ ...complete, appId: '' }));
  assert.ok(!isFirebaseConfigured(null));
});
