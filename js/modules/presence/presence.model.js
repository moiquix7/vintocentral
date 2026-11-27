/** Connected-user rules. Pure (no DOM, no Firebase). */

/** Firestore Timestamp, Date or millis → millis; anything else → null. */
function toMillis(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return Number.isFinite(value) ? value : null;
}

/**
 * Users whose last heartbeat is within `windowMs` of `now`, sorted by name.
 * A heartbeat slightly in the future (clock skew) still counts.
 * @param {Array<{ id: string, displayName?: string, lastSeen?: unknown }>} entries
 * @returns {Array<{ id: string, displayName: string }>}
 */
export function connectedUsers(entries, now, windowMs) {
  return entries
    .filter((entry) => {
      const seen = toMillis(entry.lastSeen);
      return seen !== null && now - seen <= windowMs;
    })
    .map((entry) => ({ id: entry.id, displayName: typeof entry.displayName === 'string' && entry.displayName ? entry.displayName : 'Usuario' }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
