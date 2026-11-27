/** Dashboard indicators computed from the in-memory asset list. Pure. */
import { ATTENTION_AVAILABILITY, ATTENTION_CONDITIONS, AVAILABILITY, CONDITIONS } from '../../config/app-config.js';
import { availabilityOf } from '../assets/asset.model.js';

/**
 * Groups by `keyOf`, summing quantities (units). Sorted by units descending.
 * @returns {Array<{ key: string, label: string, units: number }>}
 */
function groupUnits(assets, keyOf, labelOf) {
  const totals = new Map();
  for (const asset of assets) {
    const key = keyOf(asset) || '';
    totals.set(key, (totals.get(key) ?? 0) + quantityOf(asset));
  }
  return [...totals.entries()]
    .map(([key, units]) => ({ key, label: labelOf(key), units }))
    .sort((a, b) => b.units - a.units || a.label.localeCompare(b.label));
}

/** Units per value of a fixed list (every value listed, even with 0 units), in the list's order. */
function unitsPerOption(assets, options, valueOf) {
  return Object.keys(options).map((key) => ({
    key,
    label: options[key],
    units: assets.filter((a) => valueOf(a) === key).reduce((sum, a) => sum + quantityOf(a), 0),
  }));
}

/**
 * Every department (also those with 0 articles) with the number of articles registered in it.
 * Largest first, then A → Z. "Sin departamento" is added only when some article has none
 * (or points to a department that no longer exists).
 * @param {Array<object>} assets
 * @param {Array<{ id: string, name: string }>} departments
 * @returns {Array<{ key: string, label: string, units: number }>} `units` = number of articles
 */
export function articlesPerDepartment(assets, departments) {
  const counts = new Map(departments.map((department) => [department.id, 0]));
  let orphans = 0;
  for (const asset of assets) {
    if (counts.has(asset.categoryId)) counts.set(asset.categoryId, counts.get(asset.categoryId) + 1);
    else orphans += 1;
  }
  const rows = departments
    .map((department) => ({ key: department.id, label: department.name, units: counts.get(department.id) }))
    .sort((a, b) => b.units - a.units || a.label.localeCompare(b.label));
  if (orphans) rows.push({ key: '', label: 'Sin departamento', units: orphans });
  return rows;
}

/** An article needs attention when it is in bad condition, under repair or missing. */
export function needsAttention(asset) {
  return ATTENTION_CONDITIONS.includes(asset.condition) || ATTENTION_AVAILABILITY.includes(availabilityOf(asset));
}

function quantityOf(asset) {
  return Number.isInteger(asset.quantity) && asset.quantity > 0 ? asset.quantity : 1;
}

/**
 * @param {Array<object>} assets
 * @param {{ typeName: (id: string) => string, categoryName: (id: string) => string, locationName: (id: string) => string }} lookups
 */
export function computeStats(assets, lookups) {
  let totalUnits = 0;
  let totalValue = 0;
  let attention = 0;
  for (const asset of assets) {
    const units = quantityOf(asset);
    totalUnits += units;
    totalValue += (Number(asset.value) || 0) * units;
    if (needsAttention(asset)) attention += 1;
  }
  return {
    totalRecords: assets.length,
    totalUnits,
    totalValue,
    needsAttention: attention,
    byType: groupUnits(assets, (a) => a.typeId, lookups.typeName),
    byCategory: groupUnits(assets, (a) => a.categoryId, lookups.categoryName),
    byLocation: groupUnits(assets, (a) => a.locationId, lookups.locationName),
    byCondition: unitsPerOption(assets, CONDITIONS, (a) => a.condition),
    byAvailability: unitsPerOption(assets, AVAILABILITY, availabilityOf),
  };
}
