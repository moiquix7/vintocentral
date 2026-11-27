import { test } from 'node:test';
import assert from 'node:assert/strict';
import { niceScale } from '../js/shared/chart-scale.js';

test('niceScale: round steps (1, 2, 5 × 10^k) from 0 up to a max that covers the data', () => {
  assert.deepEqual(niceScale(14), { max: 15, step: 5, ticks: [0, 5, 10, 15] });
  assert.deepEqual(niceScale(8), { max: 8, step: 2, ticks: [0, 2, 4, 6, 8] });
  assert.deepEqual(niceScale(3), { max: 3, step: 1, ticks: [0, 1, 2, 3] });
  assert.deepEqual(niceScale(237), { max: 300, step: 100, ticks: [0, 100, 200, 300] });
  assert.equal(niceScale(1000).step, 500);
});

test('niceScale: counts never get fractional steps; empty data still has an axis', () => {
  assert.deepEqual(niceScale(1), { max: 1, step: 1, ticks: [0, 1] });
  assert.deepEqual(niceScale(0), { max: 1, step: 1, ticks: [0, 1] });
  assert.deepEqual(niceScale(-5), { max: 1, step: 1, ticks: [0, 1] });
  assert.deepEqual(niceScale(Number.NaN), { max: 1, step: 1, ticks: [0, 1] });
});

test('niceScale: the max always covers the largest value and ticks stay few', () => {
  for (const value of [2, 7, 11, 19, 42, 99, 101, 555, 9999]) {
    const { max, ticks } = niceScale(value);
    assert.ok(max >= value, `max ${max} >= ${value}`);
    assert.ok(ticks.length >= 2 && ticks.length <= 7, `${ticks.length} ticks for ${value}`);
  }
});
