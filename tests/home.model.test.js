import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityOf, recentActivity } from '../js/modules/home/home.model.js';

const ts = (millis) => ({ toMillis: () => millis });

test('activity: created, verified in an inventory-taking, or updated', () => {
  assert.equal(activityOf({ createdAt: ts(5), updatedAt: ts(5) }), 'created');
  assert.equal(activityOf({ createdAt: ts(5), updatedAt: ts(9), checkedAt: ts(9) }), 'checked');
  assert.equal(activityOf({ createdAt: ts(5), updatedAt: ts(9), checkedAt: ts(7) }), 'updated');
  assert.equal(activityOf({}), 'created');
});

test('the last N articles, oldest first, ignoring undated ones', () => {
  const assets = Array.from({ length: 13 }, (_, i) => ({ id: String(i), createdAt: ts(i), updatedAt: ts(i * 10) }));
  assets.push({ id: 'no-date' });
  const recent = recentActivity(assets, 10);
  assert.equal(recent.length, 10);
  assert.deepEqual(recent.map((item) => item.asset.id), ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
  assert.equal(recent[0].activity, 'updated');
  assert.deepEqual(recentActivity([], 10), []);
});
