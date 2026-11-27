/**
 * Inventory-taking rules. Pure (no DOM, no Firebase).
 * A "round" starts on a date chosen by the user; an article is verified in that round when its
 * `checkedAt` is on or after the start of that day (local time).
 */
import { foldText, isIsoDate } from '../../shared/validation.js';
import { availabilityOf } from '../assets/asset.model.js';

export const CHECK_STATUS = Object.freeze({
  pending: 'Pendientes de verificar',
  checked: 'Ya verificados',
  all: 'Todos',
});

export const DEFAULT_CHECK_STATUS = 'pending';

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

export function filterByCheck(assets, status, roundStart) {
  if (status === 'checked') return assets.filter((asset) => isChecked(asset, roundStart));
  if (status === 'pending') return assets.filter((asset) => !isChecked(asset, roundStart));
  return assets;
}

/** @returns {{ checked: number, total: number, percent: number }} percent rounded down (100 only when all are done) */
export function inventoryProgress(assets, roundStart) {
  const total = assets.length;
  const checked = assets.filter((asset) => isChecked(asset, roundStart)).length;
  return { checked, total, percent: total ? Math.floor((checked / total) * 100) : 0 };
}

/**
 * Walking order: by location, then by name (accent- and case-insensitive). Returns a new array.
 * @param {(id: string) => string} locationName
 */
export function sortForWalk(assets, locationName) {
  const key = (asset) => [foldText(locationName(asset.locationId)), foldText(asset.name)];
  return [...assets].sort((a, b) => {
    const [aPlace, aName] = key(a);
    const [bPlace, bName] = key(b);
    return aPlace.localeCompare(bPlace) || aName.localeCompare(bName);
  });
}

/** The values the grid edits, as currently stored (old articles: availability defaults to available). */
export function storedStatus(asset) {
  return { locationId: asset.locationId ?? '', condition: asset.condition ?? '', availability: availabilityOf(asset) };
}

/** True when the draft differs from what is stored. */
export function hasChanges(asset, draft) {
  const stored = storedStatus(asset);
  return Object.keys(stored).some((key) => draft[key] !== stored[key]);
}
