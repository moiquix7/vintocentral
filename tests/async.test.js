import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapWithConcurrency } from '../js/shared/async.js';

test('mapWithConcurrency keeps order and never exceeds the limit', async () => {
  let running = 0;
  let peak = 0;
  const result = await mapWithConcurrency([30, 5, 20, 1, 10, 2], 3, async (ms, index) => {
    running += 1;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, ms));
    running -= 1;
    return index * 10;
  });
  assert.deepEqual(result, [0, 10, 20, 30, 40, 50]);
  assert.ok(peak <= 3, `peak was ${peak}`);
});

test('mapWithConcurrency handles empty input', async () => {
  assert.deepEqual(await mapWithConcurrency([], 4, async () => 1), []);
});
