/**
 * Inventory-taking rules. Pure (no DOM, no Firebase).
 * A "round" starts on a date chosen by the user; an article is verified in that round when its
 * `checkedAt` is on or after the start of that day (local time).
 */
import { isIsoDate } from '../../shared/validation.js';
import { INVENTORY_FIELDS, availabilityOf, isUnavailable } from '../assets/asset.model.js';

export const CHECK_STATUS = Object.freeze({
  pending: 'Pendientes de verificar',
  checked: 'Ya verificados',
  all: 'Todos',
});

export const DEFAULT_CHECK_STATUS = 'pending';

/** Walking order: by location (ties by name). A key of SORT_OPTIONS in asset-filter.js. */
export const DEFAULT_INVENTORY_SORT = 'location:asc';

/** Keeps a stored start date only when it is a real date not in the future; otherwise `today`. */
export function normalizeRoundStart(value, today) {
  return isIsoDate(value) && value <= today ? value : today;
}

/** Local midnight of a YYYY-MM-DD date, in milliseconds. */
function startOfDay(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

/** Firestore Timestamp, Date or millis → millis; anything else → null. */
function toMillis(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return Number.isFinite(value) ? value : null;
}

export function isChecked(asset, roundStart) {
  const checkedAt = toMillis(asset?.checkedAt);
  return checkedAt !== null && checkedAt >= startOfDay(roundStart);
}

/**
 * @param {Set<string>} [keep] ids that stay listed whatever their state (rows edited since the
 *   filters last changed, so a row does not vanish from "Pendientes" after its first save)
 */
export function filterByCheck(assets, status, roundStart, keep = new Set()) {
  if (status === 'checked') return assets.filter((asset) => keep.has(asset.id) || isChecked(asset, roundStart));
  if (status === 'pending') return assets.filter((asset) => keep.has(asset.id) || !isChecked(asset, roundStart));
  return assets;
}

/** @returns {{ checked: number, total: number, percent: number }} percent rounded down (100 only when all are done) */
export function inventoryProgress(assets, roundStart) {
  const total = assets.length;
  const checked = assets.filter((asset) => isChecked(asset, roundStart)).length;
  return { checked, total, percent: total ? Math.floor((checked / total) * 100) : 0 };
}

/** The values the grid edits, as currently stored (old articles: availability defaults to available). */
export function storedStatus(asset) {
  const availability = availabilityOf(asset);
  return {
    locationId: asset.locationId ?? '',
    condition: asset.condition ?? '',
    availability,
    unavailableReason: isUnavailable(availability) ? asset.unavailableReason ?? '' : '',
    notes: asset.notes ?? '',
  };
}

/** True when two sets of grid values are equal (missing values count as empty). */
export function sameStatus(a, b) {
  return INVENTORY_FIELDS.every((key) => (a?.[key] ?? '') === (b?.[key] ?? ''));
}
