/**
 * Asset model: whitelisting, sanitising and validation. Pure (no DOM, no Firebase).
 * The field list and limits must match `validAsset()` in firestore.rules.
 */
import { CONDITIONS, LIMITS } from '../../config/app-config.js';
import { cleanText, cleanMultiline, toNumber, isIsoDate } from '../../shared/validation.js';

const L = LIMITS.asset;

/** Editable fields written by the form (stamps are added by the service). */
export const ASSET_FIELDS = Object.freeze([
  'code',
  'name',
  'description',
  'categoryId',
  'locationId',
  'condition',
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
    categoryId: cleanText(input.categoryId, 64),
    locationId: cleanText(input.locationId, 64),
    condition: cleanText(input.condition, 20),
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
  if (!asset.name) errors.name = 'Escriba el nombre del bien.';
  if (!asset.categoryId) errors.categoryId = 'Elija un departamento.';
  if (!asset.locationId) errors.locationId = 'Elija una ubicación.';
  if (!Object.hasOwn(CONDITIONS, asset.condition)) errors.condition = 'Elija el estado del bien.';
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

/** Keeps only {path, url} string pairs, at most the photo limit. */
export function sanitizePhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos
    .filter((p) => p && typeof p.path === 'string' && typeof p.url === 'string')
    .slice(0, L.photos)
    .map(({ path, url }) => ({ path, url }));
}
