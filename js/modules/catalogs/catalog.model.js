/**
 * Department (stored as `categories`) / location model. Pure.
 * Must match `validCatalog()` and `validDepartment()` in firestore.rules.
 * Departments also keep a leader history: [{ name, from, to }] where `to: null` means "still leading".
 */
import { LIMITS } from '../../config/app-config.js';
import { cleanText, foldText } from '../../shared/validation.js';

const L = LIMITS.catalog;

function thisYear() {
  return new Date().getFullYear();
}

/** Years offered in the dropdowns: next year down to the first allowed year (newest first). */
export function yearOptions(currentYear = thisYear()) {
  const years = [];
  for (let year = currentYear + 1; year >= L.firstYear; year -= 1) years.push(year);
  return years;
}

function toYear(value) {
  if (value === null || value === undefined || value === '') return null;
  const year = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isInteger(year) ? year : Number.NaN;
}

/** Current leaders first, then most recent start year, then most recent end year. */
export function sortLeaders(leaders) {
  return [...leaders].sort((a, b) => {
    const aCurrent = a.to === null ? 1 : 0;
    const bCurrent = b.to === null ? 1 : 0;
    return bCurrent - aCurrent || (b.from ?? 0) - (a.from ?? 0) || (b.to ?? 0) - (a.to ?? 0);
  });
}

/** Keeps only {name, from, to}; drops completely empty rows; limits the count. */
export function sanitizeLeaders(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => ({ name: cleanText(row?.name, L.leader), from: toYear(row?.from), to: toYear(row?.to) }))
    .filter((row) => row.name || row.from !== null || row.to !== null)
    .slice(0, L.maxLeaders);
}

/** @returns {string|null} first problem found (rows numbered from 1), or null when valid */
export function validateLeaders(leaders, currentYear = thisYear()) {
  const maxYear = currentYear + 1;
  for (const [index, leader] of leaders.entries()) {
    const label = `Líder ${index + 1}`;
    if (!leader.name) return `${label}: escriba el nombre.`;
    if (leader.from === null) return `${label}: elija el año de inicio.`;
    if (!Number.isInteger(leader.from) || leader.from < L.firstYear || leader.from > maxYear) {
      return `${label}: el año de inicio no es válido.`;
    }
    if (leader.to !== null) {
      if (!Number.isInteger(leader.to) || leader.to > maxYear) return `${label}: el año final no es válido.`;
      if (leader.to < leader.from) return `${label}: el año final debe ser igual o mayor que el de inicio.`;
    }
  }
  return null;
}

/**
 * Leader history of a stored department, also reading the short-lived legacy fields
 * `leader` + `term` ("2026" or "2025-2026") as a one-item history.
 */
export function leadersOf(item) {
  if (Array.isArray(item?.leaders)) return sortLeaders(sanitizeLeaders(item.leaders));
  if (!item?.leader) return [];
  const match = /^(\d{4})(?:-(\d{4}))?$/.exec(item.term ?? '');
  const from = match ? Number(match[1]) : null;
  const to = match ? Number(match[2] ?? match[1]) : null;
  return [{ name: item.leader, from, to }];
}

/** Leaders still in office (`to` null or this year or later). */
export function currentLeaders(leaders, currentYear = thisYear()) {
  return leaders.filter((leader) => leader.to === null || leader.to >= currentYear);
}

/** "2026", "2024 – 2025" or "2024 – actualidad". */
export function periodText({ from, to }) {
  if (from === null || from === undefined) return to ? `hasta ${to}` : 'sin fecha';
  if (to === null || to === undefined) return `${from} – actualidad`;
  return from === to ? String(from) : `${from} – ${to}`;
}

/**
 * Keeps only known fields. Departments (withLeader) always get `leaders` (possibly empty), in the
 * order typed so error messages match the screen; sort with sortLeaders() before saving.
 * Locations never get `leaders`.
 */
export function sanitizeCatalogItem(input = {}, { withLeader = false } = {}) {
  const item = {
    name: cleanText(input.name, L.name),
    description: cleanText(input.description, L.description),
  };
  if (withLeader) item.leaders = sanitizeLeaders(input.leaders);
  return item;
}

/**
 * @param {{ name: string, leaders?: object[] }} item sanitized item
 * @param {Array<{ id: string, name: string }>} existing current items
 * @param {string|null} currentId id being edited (excluded from the duplicate check)
 */
export function validateCatalogItem(item, existing, currentId = null, currentYear = thisYear()) {
  const errors = {};
  if (!item.name) errors.name = 'Escriba un nombre.';
  else if (existing.some((other) => other.id !== currentId && foldText(other.name) === foldText(item.name))) {
    errors.name = 'Ya existe un registro con ese nombre.';
  }
  if (item.leaders) {
    const leadersError = validateLeaders(item.leaders, currentYear);
    if (leadersError) errors.leaders = leadersError;
  }
  return errors;
}
