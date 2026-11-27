/**
 * Change history of articles: what changed, described as readable text. Pure (no DOM, no Firebase).
 * The entry shape must match `validHistory()` in firestore.rules.
 */
import { AVAILABILITY, CONDITIONS, DEFAULT_AVAILABILITY, LIMITS } from '../../config/app-config.js';
import { cleanText, foldText } from '../../shared/validation.js';
import { formatCurrency, formatDate, formatNumber } from '../../shared/format.js';

const L = LIMITS.history;

/** Action → label shown in the history ("Luz Andrea · Modificó"). */
export const HISTORY_ACTIONS = Object.freeze({
  create: 'Registró el artículo',
  update: 'Modificó',
  check: 'Verificó (toma de inventario)',
  delete: 'Eliminó el artículo',
});

/** Article fields tracked by the history, with the label shown to the user (in form order). */
export const FIELD_LABELS = Object.freeze({
  name: 'Nombre',
  code: 'Código',
  description: 'Descripción',
  typeId: 'Categoría',
  categoryId: 'Departamento',
  locationId: 'Ubicación',
  tags: 'Etiquetas',
  condition: 'Estado',
  availability: 'Disponibilidad',
  unavailableReason: 'Motivo',
  notes: 'Observaciones',
  quantity: 'Cantidad',
  value: 'Valor unitario',
  acquisitionDate: 'Fecha de adquisición',
  photos: 'Fotos',
});

const TRACKED_FIELDS = Object.freeze(Object.keys(FIELD_LABELS));

function availabilityKey(value) {
  return Object.hasOwn(AVAILABILITY, value) ? value : DEFAULT_AVAILABILITY;
}

/** Comparable form of a stored value (photos by path, missing availability = available). */
function rawKey(field, value) {
  if (field === 'photos') return Array.isArray(value) ? value.map((photo) => photo?.path ?? '').join('|') : '';
  if (field === 'tags') return Array.isArray(value) ? value.join('|') : '';
  if (field === 'availability') return availabilityKey(value);
  return value === undefined || value === null ? '' : String(value);
}

/**
 * Readable text of a field value, e.g. locationId 'x1' → 'Templo', condition 'poor' → 'Malo'.
 * @param {{ typeName: Function, categoryName: Function, locationName: Function }} lookups catalog names
 */
export function describeValue(field, value, lookups) {
  switch (field) {
    case 'typeId':
      return value ? lookups.typeName(value) : '';
    case 'categoryId':
      return value ? lookups.categoryName(value) : '';
    case 'locationId':
      return value ? lookups.locationName(value) : '';
    case 'condition':
      return CONDITIONS[value] ?? '';
    case 'availability':
      return AVAILABILITY[availabilityKey(value)];
    case 'tags':
      return Array.isArray(value) ? value.join(', ') : '';
    case 'value':
      return Number.isFinite(value) ? formatCurrency(value) : '';
    case 'quantity':
      return Number.isFinite(value) ? formatNumber(value) : '';
    case 'acquisitionDate':
      return value ? formatDate(value) : '';
    case 'photos': {
      const count = Array.isArray(value) ? value.length : 0;
      return count === 1 ? '1 foto' : `${count} fotos`;
    }
    default:
      return typeof value === 'string' ? value : '';
  }
}

/**
 * Fields that differ between the stored article and the data being written.
 * Only fields present in `after` are compared (a partial update leaves the rest unchanged).
 * @returns {Array<{ field: string, from: string, to: string }>} at most LIMITS.history.changes
 */
export function diffAssets(before, after, lookups) {
  const previous = before ?? {};
  const changes = [];
  for (const field of TRACKED_FIELDS) {
    if (!after || !Object.hasOwn(after, field)) continue;
    if (rawKey(field, previous[field]) === rawKey(field, after[field])) continue;
    changes.push({
      field,
      from: cleanText(describeValue(field, previous[field], lookups), L.text),
      to: cleanText(describeValue(field, after[field], lookups), L.text),
    });
  }
  return changes.slice(0, L.changes);
}

/**
 * Whitelisted entry ready to write (the service adds the server time `at`).
 * @returns {{ assetId: string, assetName: string, action: string, changes: Array<object>, by: string, byName: string }}
 */
export function sanitizeHistoryEntry({ assetId, assetName, action, changes, by, byName }) {
  return {
    assetId: cleanText(assetId, 64),
    assetName: cleanText(assetName, LIMITS.asset.name) || '(sin nombre)',
    action: Object.hasOwn(HISTORY_ACTIONS, action) ? action : 'update',
    changes: (Array.isArray(changes) ? changes : [])
      .filter((change) => Object.hasOwn(FIELD_LABELS, change?.field))
      .slice(0, L.changes)
      .map((change) => ({ field: change.field, from: cleanText(change.from, L.text), to: cleanText(change.to, L.text) })),
    by: cleanText(by, 128),
    byName: cleanText(byName, LIMITS.user.displayName) || 'Usuario',
  };
}

/** Firestore Timestamp, Date or millis → millis (0 when unknown, e.g. a pending server time). */
function toMillis(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return Number.isFinite(value) ? value : 0;
}

/** Oldest first (chronological). Returns a new array. */
export function sortChronological(entries) {
  return [...entries].sort((a, b) => toMillis(a.at) - toMillis(b.at));
}

/** Newest first. Returns a new array. */
export function sortNewestFirst(entries) {
  return [...entries].sort((a, b) => toMillis(b.at) - toMillis(a.at));
}

/**
 * Text (article name or user, accent-insensitive) and action filters for the history page.
 * @param {{ text?: string, action?: string }} filters
 */
export function filterHistory(entries, { text = '', action = '' } = {}) {
  const words = foldText(text).split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    if (action && entry.action !== action) return false;
    if (!words.length) return true;
    const haystack = foldText(`${entry.assetName ?? ''} ${entry.byName ?? ''}`);
    return words.every((word) => haystack.includes(word));
  });
}
