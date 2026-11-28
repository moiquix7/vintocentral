/** User profile model. Pure. Must match `validUser()` / `validUsername()` in firestore.rules. */
import { LIMITS, PHONE_PATTERN, ROLES, USERNAME_PATTERN } from '../../config/app-config.js';
import { cleanText, foldText, isValidEmail } from '../../shared/validation.js';

const L = LIMITS.user;

/**
 * "Moisés Rodríguez" → "moises.rodriguez". Lowercase, no accents, spaces become dots,
 * other characters are kept so validateUsername() can report them.
 */
export function normalizeUsername(value) {
  return foldText(cleanText(String(value ?? ''), L.usernameMax + 10)).replace(/\s+/g, '.');
}

/** @returns {string|null} error message, or null when valid */
export function validateUsername(username) {
  if (!username) return 'Escriba un nombre de usuario.';
  if (username.length < L.usernameMin || username.length > L.usernameMax) {
    return `El nombre de usuario debe tener entre ${L.usernameMin} y ${L.usernameMax} caracteres.`;
  }
  if (!USERNAME_PATTERN.test(username)) {
    return 'Use solo letras, números, punto, guion o guion bajo (sin espacios).';
  }
  return null;
}

/** "+591  700-12345 " → "+591 700-12345" (trimmed, single spaces, cut to the limit). */
export function normalizePhone(value) {
  return cleanText(String(value ?? ''), L.phone);
}

/** @returns {string|null} error message, or null when valid (empty = no phone) */
export function validatePhone(phone) {
  if (!phone) return null;
  if (!PHONE_PATTERN.test(phone)) return 'Use solo números, espacios y los signos + - ( ).';
  if (phone.replace(/\D/g, '').length < 7) return 'El número debe tener al menos 7 dígitos.';
  return null;
}

/** Login accepts a username or an email. */
export function isEmailIdentifier(value) {
  return typeof value === 'string' && value.includes('@');
}

function cleanPassword(value) {
  return typeof value === 'string' ? value.slice(0, L.maxPassword) : '';
}

export function sanitizeNewUser(input = {}) {
  return {
    displayName: cleanText(input.displayName, L.displayName),
    username: normalizeUsername(input.username),
    email: cleanText(input.email, L.email).toLowerCase(),
    role: cleanText(input.role, 10),
    departmentId: cleanText(input.departmentId, 64),
    password: cleanPassword(input.password),
  };
}

export function validateNewUser(user) {
  const errors = {};
  if (!user.displayName) errors.displayName = 'Escriba el nombre de la persona.';
  const usernameError = validateUsername(user.username);
  if (usernameError) errors.username = usernameError;
  if (!isValidEmail(user.email)) errors.email = 'Escriba un correo electrónico válido.';
  if (!Object.hasOwn(ROLES, user.role)) errors.role = 'Elija un rol.';
  if (user.password.length < L.minPassword) {
    errors.password = `La contraseña debe tener al menos ${L.minPassword} caracteres.`;
  }
  return errors;
}

/** Fields a user may change on their own profile (the email has its own flow: validateEmailChange). */
export function sanitizeProfileUpdate(input = {}) {
  return {
    displayName: cleanText(input.displayName, L.displayName),
    username: normalizeUsername(input.username),
    phone: normalizePhone(input.phone),
  };
}

export function validateProfileUpdate(profile) {
  const errors = {};
  if (!profile.displayName) errors.displayName = 'Escriba su nombre.';
  const usernameError = validateUsername(profile.username);
  if (usernameError) errors.username = usernameError;
  const phoneError = validatePhone(profile.phone);
  if (phoneError) errors.phone = phoneError;
  return errors;
}

/**
 * New email for the signed-in user (a verification link is sent to it).
 * @returns {{ email: string, errors: Record<string, string> }}
 */
export function validateEmailChange({ newEmail, currentEmail, currentPassword }) {
  const email = cleanText(newEmail, L.email).toLowerCase();
  const errors = {};
  if (!isValidEmail(email)) errors.newEmail = 'Escriba un correo electrónico válido.';
  else if (email === String(currentEmail ?? '').toLowerCase()) errors.newEmail = 'Ese ya es su correo actual.';
  if (!currentPassword) errors.emailPassword = 'Escriba su contraseña actual.';
  return { email, errors };
}

export function validatePasswordChange({ currentPassword, newPassword, confirmPassword }) {
  const errors = {};
  if (!currentPassword) errors.currentPassword = 'Escriba su contraseña actual.';
  if (cleanPassword(newPassword).length < L.minPassword) {
    errors.newPassword = `La nueva contraseña debe tener al menos ${L.minPassword} caracteres.`;
  } else if (newPassword === currentPassword) {
    errors.newPassword = 'La nueva contraseña debe ser distinta de la actual.';
  }
  if (confirmPassword !== newPassword) errors.confirmPassword = 'Las contraseñas no coinciden.';
  return errors;
}

/**
 * An admin cannot remove their own admin role or deactivate themselves
 * (prevents locking everyone out). Also enforced in firestore.rules.
 */
export function validateProfileChange({ targetUid, currentUid, role, active }) {
  if (!Object.hasOwn(ROLES, role)) return 'Rol no válido.';
  if (typeof active !== 'boolean') return 'Estado no válido.';
  if (targetUid === currentUid && (role !== 'admin' || !active)) {
    return 'No puede quitarse a sí mismo el rol de administrador ni desactivar su propia cuenta.';
  }
  return null;
}
