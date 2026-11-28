/** Search, filter and sort for the user list (#/users). Pure (no DOM, no Firebase). */
import { ROLES } from '../../config/app-config.js';
import { foldText } from '../../shared/validation.js';

export const USER_STATUS = Object.freeze({ active: 'Activos', inactive: 'Inactivos' });

export const USER_SORT_OPTIONS = Object.freeze({
  'name:asc': 'Nombre (A → Z)',
  'name:desc': 'Nombre (Z → A)',
  'username:asc': 'Usuario (A → Z)',
  'role:asc': 'Rol (administradores primero)',
  'status:asc': 'Estado (activos primero)',
});

export const EMPTY_USER_FILTERS = Object.freeze({ text: '', role: '', status: '', sort: 'name:asc' });

const ROLE_ORDER = Object.keys(ROLES);

/** Active only when the stored flag is exactly true (same rule as the session and the security rules). */
export function isActiveUser(user) {
  return user?.active === true;
}

/**
 * @param {Array<object>} users users/{uid} documents with `uid`
 * @param {typeof EMPTY_USER_FILTERS} filters text: name, username or email (accent/case-insensitive)
 */
export function filterUsers(users, filters) {
  const words = foldText(filters.text).split(/\s+/).filter(Boolean);
  return users.filter((user) => {
    if (filters.role && user.role !== filters.role) return false;
    if (filters.status === 'active' && !isActiveUser(user)) return false;
    if (filters.status === 'inactive' && isActiveUser(user)) return false;
    if (!words.length) return true;
    const haystack = foldText(`${user.displayName ?? ''} ${user.username ?? ''} ${user.email ?? ''}`);
    return words.every((word) => haystack.includes(word));
  });
}

const byName = (a, b) => foldText(a.displayName).localeCompare(foldText(b.displayName));
const rank = (role) => {
  const index = ROLE_ORDER.indexOf(role);
  return index < 0 ? ROLE_ORDER.length : index;
};

const COMPARATORS = Object.freeze({
  'name:asc': byName,
  'name:desc': (a, b) => byName(b, a),
  // Users without a username (legacy) go last.
  'username:asc': (a, b) => (a.username ? 0 : 1) - (b.username ? 0 : 1) || String(a.username ?? '').localeCompare(String(b.username ?? '')) || byName(a, b),
  'role:asc': (a, b) => rank(a.role) - rank(b.role) || byName(a, b),
  'status:asc': (a, b) => Number(isActiveUser(b)) - Number(isActiveUser(a)) || byName(a, b),
});

/** Returns a new sorted array; an unknown sort key falls back to name A → Z. */
export function sortUsers(users, sort) {
  return [...users].sort(COMPARATORS[sort] ?? COMPARATORS['name:asc']);
}
