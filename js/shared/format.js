/** Display formatting (locale and currency come from app-config). */
import { APP } from '../config/app-config.js';

/**
 * Amounts follow CLAUDE.md "CURRENCY": symbol in front, decimal point and always two decimals
 * ("Bs. 1,250.50"). Fixed digits (en-US) so every browser shows the same text.
 */
const amountFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numberFormat = new Intl.NumberFormat(APP.locale);
const dateFormat = new Intl.DateTimeFormat(APP.locale, { dateStyle: 'medium' });
const dateTimeFormat = new Intl.DateTimeFormat(APP.locale, { dateStyle: 'medium', timeStyle: 'short' });

/** 100 → "Bs. 100.00"; 1250.5 → "Bs. 1,250.50"; not a number → "—". */
export function formatCurrency(value) {
  return Number.isFinite(value) ? `${APP.currencySymbol} ${amountFormat.format(value)}` : '—';
}

/** Value for an amount input: 150.5 → "150.50"; empty/invalid → "". */
export function amountInputValue(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '';
}

export function formatNumber(value) {
  return Number.isFinite(value) ? numberFormat.format(value) : '—';
}

/** Accepts 'YYYY-MM-DD', Date, or a Firestore Timestamp. */
export function formatDate(value) {
  const date = toDate(value);
  return date ? dateFormat.format(date) : '—';
}

export function formatDateTime(value) {
  const date = toDate(value);
  return date ? dateTimeFormat.format(date) : '—';
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return null;
}

/** Local date as YYYY-MM-DD (for file names and date inputs). */
export function todayIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Share of `part` in `total`, as a whole percent (0 when total is 0). */
export function percentOf(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
