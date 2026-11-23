/** Display formatting (locale and currency come from app-config). */
import { APP } from '../config/app-config.js';

const currencyFormat = new Intl.NumberFormat(APP.locale, {
  style: 'currency',
  currency: APP.currency,
  maximumFractionDigits: 2,
});
const numberFormat = new Intl.NumberFormat(APP.locale);
const dateFormat = new Intl.DateTimeFormat(APP.locale, { dateStyle: 'medium' });
const dateTimeFormat = new Intl.DateTimeFormat(APP.locale, { dateStyle: 'medium', timeStyle: 'short' });

export function formatCurrency(value) {
  return Number.isFinite(value) ? currencyFormat.format(value) : '—';
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
