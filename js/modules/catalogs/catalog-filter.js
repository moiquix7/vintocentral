/**
 * Client-side search, filter and sort for the "Registros" list pages
 * (tipos de artículo, departamentos, ubicaciones). Pure.
 */
import { foldText } from '../../shared/validation.js';
import { leadersOf, currentLeaders } from './catalog.model.js';

export const SORT_OPTIONS = Object.freeze({
  'name:asc': 'Nombre (A → Z)',
  'name:desc': 'Nombre (Z → A)',
  'usage:desc': 'Más artículos primero',
  'usage:asc': 'Menos artículos primero',
  'updatedAt:desc': 'Modificados recientemente',
});

export const USAGE_FILTERS = Object.freeze({
  used: 'En uso (tiene artículos)',
  unused: 'Sin uso (sin artículos)',
});

/** Departments only. */
export const LEADER_FILTERS = Object.freeze({
  current: 'Con líder actual',
  none: 'Sin líder actual',
});

export const EMPTY_FILTERS = Object.freeze({
  text: '',
  usage: '',
  leader: '',
  sort: 'name:asc',
});

/**
 * How many articles use each record.
 * @param {Array<object>} assets
 * @param {string} field asset field holding the record id (typeId, categoryId, locationId)
 * @returns {Map<string, number>} record id → number of articles
 */
export function countUsage(assets, field) {
  const counts = new Map();
  for (const asset of assets) {
    const id = asset?.[field];
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/**
 * @param {Array<object>} items records of one kind
 * @param {typeof EMPTY_FILTERS} filters
 * @param {Map<string, number>} [usage] from countUsage()
 * @param {number} [currentYear] for "current leader" (tests)
 */
export function filterCatalogItems(items, filters, usage = new Map(), currentYear = undefined) {
  const words = foldText(filters.text).split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    const used = (usage.get(item.id) ?? 0) > 0;
    if (filters.usage === 'used' && !used) return false;
    if (filters.usage === 'unused' && used) return false;

    const leaders = leadersOf(item);
    if (filters.leader) {
      const hasCurrent = currentLeaders(leaders, currentYear).length > 0;
      if (filters.leader === 'current' && !hasCurrent) return false;
      if (filters.leader === 'none' && hasCurrent) return false;
    }

    if (!words.length) return true;
    const haystack = foldText([item.name, item.description, ...leaders.map((leader) => leader.name)].join(' '));
    return words.every((word) => haystack.includes(word));
  });
}

function compare(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortValue(item, field, usage) {
  switch (field) {
    case 'usage':
      return usage.get(item.id) ?? 0;
    case 'updatedAt':
      return item.updatedAt?.toMillis?.() ?? 0;
    default:
      return foldText(item.name);
  }
}

/**
 * Returns a new sorted array; ties are ordered by name (A → Z). Unknown keys fall back to name A → Z.
 * @param {Array<object>} items
 * @param {string} sortKey one of SORT_OPTIONS
 * @param {Map<string, number>} [usage] from countUsage()
 */
export function sortCatalogItems(items, sortKey, usage = new Map()) {
  const key = Object.hasOwn(SORT_OPTIONS, sortKey) ? sortKey : EMPTY_FILTERS.sort;
  const [field, direction] = key.split(':');
  const factor = direction === 'desc' ? -1 : 1;
  const keyed = items.map((item) => ({ item, value: sortValue(item, field, usage), name: foldText(item.name) }));
  keyed.sort((a, b) => factor * compare(a.value, b.value) || compare(a.name, b.name));
  return keyed.map((entry) => entry.item);
}
