/**
 * Asset model: whitelisting, sanitising and validation. Pure (no DOM, no Firebase).
 * The field list and limits must match `validAsset()` in firestore.rules.
 */
import {
  ATTENTION_AVAILABILITY,
  ATTENTION_CONDITIONS,
  AVAILABILITY,
  CONDITIONS,
  DEFAULT_AVAILABILITY,
  LIMITS,
  UNAVAILABLE,
} from '../../config/app-config.js';
import { cleanText, cleanMultiline, foldText, toNumber, isIsoDate } from '../../shared/validation.js';

const L = LIMITS.asset;

/** Editable fields written by the form (stamps are added by the service). */
export const ASSET_FIELDS = Object.freeze([
  'code',
  'name',
  'description',
  'brand',
  'model',
  'serialNumber',
  'builtIn',
  'insured',
  'typeId',
  'categoryId',
  'locationId',
  'condition',
  'availability',
  'unavailableReason',
  'notes',
  'tags',
  'acquisitionDate',
  'value',
  'quantity',
]);

/** "Sillas, Plásticas , sillas" → ['sillas', 'plásticas'] (lowercase, unique, limited). */
export function normalizeTags(input) {
  const parts = Array.isArray(input) ? input : String(input ?? '').split(',');
  const unique = new Set();
  for (const part of parts) {
    const tag = cleanText(String(part ?? ''), L.tagLength).toLowerCase();
    if (tag) unique.add(tag);
    if (unique.size === L.tags) break;
  }
  return [...unique];
}

/** True when the availability means "not available" (the only case where a reason is kept). */
export function isUnavailable(availability) {
  return UNAVAILABLE.includes(availability);
}

/** availability + its reason (emptied when the article is available) + notes. Shared by both sanitizers. */
function statusText(input) {
  const availability = cleanText(input.availability, 20);
  return {
    availability,
    unavailableReason: isUnavailable(availability) ? cleanText(input.unavailableReason, L.unavailableReason) : '',
    notes: cleanMultiline(input.notes, L.notes),
  };
}

/**
 * Keeps only known fields, with the right types and lengths.
 * Invalid numbers are kept as NaN/null so validateAsset() can report them.
 */
export function sanitizeAsset(input = {}) {
  const value = toNumber(input.value);
  const quantity = toNumber(input.quantity);
  return {
    code: cleanText(input.code, L.code),
    name: cleanText(input.name, L.name),
    description: cleanMultiline(input.description, L.description),
    brand: cleanText(input.brand, L.brand),
    model: cleanText(input.model, L.model),
    serialNumber: cleanText(input.serialNumber, L.serialNumber),
    builtIn: input.builtIn === true,
    insured: input.insured === true,
    typeId: cleanText(input.typeId, 64),
    categoryId: cleanText(input.categoryId, 64),
    locationId: cleanText(input.locationId, 64),
    condition: cleanText(input.condition, 20),
    ...statusText(input),
    tags: normalizeTags(input.tags),
    acquisitionDate: cleanText(input.acquisitionDate, 10),
    value: value === null ? 0 : value,
    quantity: quantity === null ? 1 : quantity,
  };
}

/**
 * @param {ReturnType<typeof sanitizeAsset>} asset
 * @returns {Record<string, string>} field → message; empty when valid
 */
export function validateAsset(asset) {
  const errors = {};
  if (!asset.name) errors.name = 'Escriba el nombre del artículo.';
  if (!asset.typeId) errors.typeId = 'Elija un tipo de artículo.';
  if (!asset.categoryId) errors.categoryId = 'Elija un departamento.';
  Object.assign(errors, validateInventoryUpdate(asset));
  if (!Number.isInteger(asset.quantity) || asset.quantity < 1 || asset.quantity > L.maxQuantity) {
    errors.quantity = `La cantidad debe ser un número entero entre 1 y ${L.maxQuantity}.`;
  }
  if (!Number.isFinite(asset.value) || asset.value < 0 || asset.value > L.maxValue) {
    errors.value = 'El valor debe ser un número igual o mayor a 0.';
  }
  if (asset.acquisitionDate && !isIsoDate(asset.acquisitionDate)) {
    errors.acquisitionDate = 'La fecha no es válida.';
  } else if (asset.acquisitionDate && asset.acquisitionDate > new Date().toISOString().slice(0, 10)) {
    errors.acquisitionDate = 'La fecha no puede ser futura.';
  }
  return errors;
}

/** Comparable form of an article name: trimmed, single spaces, no case and no accents. */
function nameKey(name) {
  return foldText(name).replace(/\s+/g, ' ').trim();
}

/**
 * Existing article with the same name (ignoring case and accents) in the same location, or null.
 * The same name in another location is allowed (identical units go in `quantity`).
 * @param {Array<object>} assets current articles
 * @param {{ name: string, locationId: string }} candidate
 * @param {string|null} [excludeId] the article being edited
 */
export function findDuplicateAsset(assets, { name, locationId }, excludeId = null) {
  const key = nameKey(name);
  if (!key || !locationId) return null;
  return assets.find((asset) => asset.id !== excludeId && asset.locationId === locationId && nameKey(asset.name) === key) ?? null;
}

/**
 * Articles whose name contains every typed word (ignoring case and accents), exact matches first,
 * then A → Z. Used to suggest existing articles while typing a name.
 * @param {Array<object>} assets
 * @param {string} text what the user typed
 * @param {{ limit?: number, excludeId?: string|null, minLength?: number }} [options]
 */
export function findSimilarAssets(assets, text, { limit = 6, excludeId = null, minLength = 2 } = {}) {
  const key = nameKey(text);
  if (key.length < minLength) return [];
  const words = key.split(' ');
  return assets
    .filter((asset) => asset.id !== excludeId)
    .map((asset) => ({ asset, name: nameKey(asset.name) }))
    .filter(({ name }) => words.every((word) => name.includes(word)))
    .sort((a, b) => Number(b.name === key) - Number(a.name === key) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ asset }) => asset);
}

/** Availability of a stored article; old articles without the field count as available. */
export function availabilityOf(asset) {
  return Object.hasOwn(AVAILABILITY, asset?.availability) ? asset.availability : DEFAULT_AVAILABILITY;
}

/** An article needs attention when it is in bad condition, under repair or missing. */
export function needsAttention(asset) {
  return ATTENTION_CONDITIONS.includes(asset?.condition) || ATTENTION_AVAILABILITY.includes(availabilityOf(asset));
}

/** Fields the inventory-taking grid may change (the service adds checkedAt and the stamps). */
export const INVENTORY_FIELDS = Object.freeze(['locationId', 'condition', 'availability', 'unavailableReason', 'notes']);

export function sanitizeInventoryUpdate(input = {}) {
  return {
    locationId: cleanText(input.locationId, 64),
    condition: cleanText(input.condition, 20),
    ...statusText(input),
  };
}

/** Also used by validateAsset(): the inventory fields share the same rules everywhere (the texts are optional). */
export function validateInventoryUpdate(update) {
  const errors = {};
  if (!update.locationId) errors.locationId = 'Elija una ubicación.';
  if (!Object.hasOwn(CONDITIONS, update.condition)) errors.condition = 'Elija el estado del artículo.';
  if (!Object.hasOwn(AVAILABILITY, update.availability)) errors.availability = 'Elija la disponibilidad del artículo.';
  return errors;
}

/** Keeps only {path, url} string pairs, at most the photo limit. */
export function sanitizePhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos
    .filter((p) => p && typeof p.path === 'string' && typeof p.url === 'string')
    .slice(0, L.photos)
    .map(({ path, url }) => ({ path, url }));
}
