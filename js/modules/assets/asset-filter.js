/** Client-side search, filter and sort for the asset list and reports. Pure. */
import { CONDITIONS } from '../../config/app-config.js';
import { foldText } from '../../shared/validation.js';

export const SORT_OPTIONS = Object.freeze({
  'name:asc': 'Nombre (A → Z)',
  'name:desc': 'Nombre (Z → A)',
  'code:asc': 'Código',
  'value:desc': 'Valor (mayor primero)',
  'value:asc': 'Valor (menor primero)',
  'updatedAt:desc': 'Modificados recientemente',
});

export const EMPTY_FILTERS = Object.freeze({
  text: '',
  categoryId: '',
  locationId: '',
  condition: '',
  sort: 'name:asc',
});

/**
 * @param {Array<object>} assets
 * @param {typeof EMPTY_FILTERS} filters
 * @param {{ categoryName: (id: string) => string, locationName: (id: string) => string }} lookups
 */
export function filterAssets(assets, filters, lookups) {
  const words = foldText(filters.text).split(/\s+/).filter(Boolean);
  return assets.filter((asset) => {
    if (filters.categoryId && asset.categoryId !== filters.categoryId) return false;
    if (filters.locationId && asset.locationId !== filters.locationId) return false;
    if (filters.condition && asset.condition !== filters.condition) return false;
    if (!words.length) return true;
    const haystack = foldText(
      [
        asset.name,
        asset.code,
        asset.description,
        ...(asset.tags ?? []),
        lookups.categoryName(asset.categoryId),
        lookups.locationName(asset.locationId),
        CONDITIONS[asset.condition],
      ].join(' '),
    );
    return words.every((word) => haystack.includes(word));
  });
}

function sortValue(asset, field) {
  if (field === 'updatedAt') return asset.updatedAt?.toMillis?.() ?? 0;
  if (field === 'value') return Number(asset.value) || 0;
  return foldText(asset[field]);
}

/** Returns a new sorted array. Unknown sort keys fall back to name ascending. */
export function sortAssets(assets, sortKey) {
  const key = Object.hasOwn(SORT_OPTIONS, sortKey) ? sortKey : EMPTY_FILTERS.sort;
  const [field, direction] = key.split(':');
  const factor = direction === 'desc' ? -1 : 1;
  return [...assets].sort((a, b) => {
    const left = sortValue(a, field);
    const right = sortValue(b, field);
    if (left < right) return -1 * factor;
    if (left > right) return 1 * factor;
    return 0;
  });
}
