/** Client-side search, filter and sort for the asset list and reports. Pure. */
import { AVAILABILITY, CONDITIONS } from '../../config/app-config.js';
import { foldText } from '../../shared/validation.js';
import { availabilityOf } from './asset.model.js';

export const SORT_OPTIONS = Object.freeze({
  'name:asc': 'Nombre (A → Z)',
  'name:desc': 'Nombre (Z → A)',
  'code:asc': 'Código',
  'type:asc': 'Categoría',
  'category:asc': 'Departamento',
  'location:asc': 'Ubicación',
  'condition:asc': 'Estado (mejor primero)',
  'condition:desc': 'Estado (peor primero)',
  'availability:asc': 'Disponibilidad',
  'value:desc': 'Valor (mayor primero)',
  'value:asc': 'Valor (menor primero)',
  'updatedAt:desc': 'Modificados recientemente',
});

export const EMPTY_FILTERS = Object.freeze({
  text: '',
  typeId: '',
  categoryId: '',
  locationId: '',
  condition: '',
  availability: '',
  sort: 'name:asc',
});

/**
 * @param {Array<object>} assets
 * @param {typeof EMPTY_FILTERS} filters
 * @param {{ typeName: (id: string) => string, categoryName: (id: string) => string, locationName: (id: string) => string }} lookups
 */
export function filterAssets(assets, filters, lookups) {
  const words = foldText(filters.text).split(/\s+/).filter(Boolean);
  return assets.filter((asset) => {
    if (filters.typeId && asset.typeId !== filters.typeId) return false;
    if (filters.categoryId && asset.categoryId !== filters.categoryId) return false;
    if (filters.locationId && asset.locationId !== filters.locationId) return false;
    if (filters.condition && asset.condition !== filters.condition) return false;
    if (filters.availability && availabilityOf(asset) !== filters.availability) return false;
    if (!words.length) return true;
    const haystack = foldText(
      [
        asset.name,
        asset.code,
        asset.description,
        ...(asset.tags ?? []),
        lookups.typeName(asset.typeId),
        lookups.categoryName(asset.categoryId),
        lookups.locationName(asset.locationId),
        CONDITIONS[asset.condition],
        AVAILABILITY[availabilityOf(asset)],
      ].join(' '),
    );
    return words.every((word) => haystack.includes(word));
  });
}

const CONDITION_ORDER = Object.keys(CONDITIONS);
const AVAILABILITY_ORDER = Object.keys(AVAILABILITY);

/** Position in a fixed list (best → worst); unknown values go last. */
function rank(order, value) {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
}

/** Lookups that show the raw id: used when the caller has no catalog names (e.g. tests). */
const ID_LOOKUPS = Object.freeze({ typeName: String, categoryName: String, locationName: String });

function sortValue(asset, field, lookups) {
  switch (field) {
    case 'updatedAt':
      return asset.updatedAt?.toMillis?.() ?? 0;
    case 'value':
      return Number(asset.value) || 0;
    case 'type':
      return foldText(lookups.typeName(asset.typeId));
    case 'category':
      return foldText(lookups.categoryName(asset.categoryId));
    case 'location':
      return foldText(lookups.locationName(asset.locationId));
    case 'condition':
      return rank(CONDITION_ORDER, asset.condition);
    case 'availability':
      return rank(AVAILABILITY_ORDER, availabilityOf(asset));
    default:
      return foldText(asset[field]);
  }
}

function compare(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Returns a new sorted array; ties are ordered by name (A → Z).
 * Unknown sort keys fall back to name ascending.
 * @param {Array<object>} assets
 * @param {string} sortKey one of SORT_OPTIONS
 * @param {{ typeName: Function, categoryName: Function, locationName: Function }} [lookups] catalog names
 */
export function sortAssets(assets, sortKey, lookups = ID_LOOKUPS) {
  const key = Object.hasOwn(SORT_OPTIONS, sortKey) ? sortKey : EMPTY_FILTERS.sort;
  const [field, direction] = key.split(':');
  const factor = direction === 'desc' ? -1 : 1;
  const keyed = assets.map((asset) => ({ asset, value: sortValue(asset, field, lookups), name: foldText(asset.name) }));
  keyed.sort((a, b) => factor * compare(a.value, b.value) || compare(a.name, b.name));
  return keyed.map((entry) => entry.asset);
}
