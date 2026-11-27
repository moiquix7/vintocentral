/** Home page: latest article activity. Pure (no DOM, no Firebase). */

/** What happened in an article's latest write, with the label shown on the home timeline. */
export const ACTIVITY = Object.freeze({
  created: 'Registrado',
  updated: 'Modificado',
  checked: 'Verificado en la toma de inventario',
});

export const RECENT_COUNT = 10;

/** Firestore Timestamp, Date or millis → millis; anything else → null. */
function toMillis(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return Number.isFinite(value) ? value : null;
}

/**
 * Kind of the article's latest write: created (createdAt = updatedAt), verified in an
 * inventory-taking (checkedAt = updatedAt) or updated.
 * @returns {'created' | 'updated' | 'checked'}
 */
export function activityOf(asset) {
  const updated = toMillis(asset?.updatedAt);
  if (updated === null || toMillis(asset?.createdAt) === updated) return 'created';
  if (toMillis(asset?.checkedAt) === updated) return 'checked';
  return 'updated';
}

/**
 * The `count` most recently added or updated articles, in chronological order (oldest first,
 * the most recent last). Articles without any date are ignored.
 * @returns {Array<{ asset: object, at: number, activity: 'created' | 'updated' | 'checked' }>}
 */
export function recentActivity(assets, count = RECENT_COUNT) {
  return assets
    .map((asset) => ({ asset, at: toMillis(asset.updatedAt) ?? toMillis(asset.createdAt) }))
    .filter((item) => item.at !== null)
    .sort((a, b) => b.at - a.at)
    .slice(0, count)
    .reverse()
    .map((item) => ({ ...item, activity: activityOf(item.asset) }));
}
