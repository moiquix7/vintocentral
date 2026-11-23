/** Category / location model. Pure. Must match `validCatalog()` in firestore.rules. */
import { LIMITS } from '../../config/app-config.js';
import { cleanText, foldText } from '../../shared/validation.js';

export function sanitizeCatalogItem(input = {}) {
  return {
    name: cleanText(input.name, LIMITS.catalog.name),
    description: cleanText(input.description, LIMITS.catalog.description),
  };
}

/**
 * @param {{ name: string }} item sanitized item
 * @param {Array<{ id: string, name: string }>} existing current items
 * @param {string|null} currentId id being edited (excluded from the duplicate check)
 */
export function validateCatalogItem(item, existing, currentId = null) {
  const errors = {};
  if (!item.name) errors.name = 'Escriba un nombre.';
  else if (existing.some((other) => other.id !== currentId && foldText(other.name) === foldText(item.name))) {
    errors.name = 'Ya existe un registro con ese nombre.';
  }
  return errors;
}
