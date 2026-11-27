import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectedUsers } from '../js/modules/presence/presence.model.js';

const now = 1_000_000_000;
const minute = 60_000;

test('only heartbeats inside the window count, sorted by name', () => {
  const entries = [
    { id: 'a', displayName: 'Zoe', lastSeen: { toMillis: () => now - minute } },
    { id: 'b', displayName: 'Ana', lastSeen: new Date(now - 4 * minute) },
    { id: 'c', displayName: 'Old', lastSeen: now - 6 * minute },
    { id: 'd', displayName: 'Pending', lastSeen: null },
    { id: 'e', lastSeen: now + 1000 },
  ];
  assert.deepEqual(connectedUsers(entries, now, 5 * minute), [
    { id: 'b', displayName: 'Ana' },
    { id: 'e', displayName: 'Usuario' },
    { id: 'a', displayName: 'Zoe' },
  ]);
  assert.deepEqual(connectedUsers([], now, 5 * minute), []);
});
