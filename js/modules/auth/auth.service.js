/**
 * Sign in (username or email) and password recovery. Sign out lives in core/session.js (endSession).
 * Usernames are resolved to the Auth email through usernames/{username} (public `get`, no `list`).
 */
import { auth, db, doc, getDoc, signInWithEmailAndPassword, sendPasswordResetEmail } from '../../core/firebase.js';
import { AppError, ValidationError, toAppError } from '../../core/errors.js';
import { cleanText, isValidEmail } from '../../shared/validation.js';
import { COLLECTIONS, LIMITS } from '../../config/app-config.js';
import { isEmailIdentifier, normalizeUsername, validateUsername } from '../users/user.model.js';

const WRONG_CREDENTIALS = 'Usuario o contraseña incorrectos.';

/** @returns {Promise<string|null>} the email for a username/email identifier, or null if unknown */
async function resolveEmail(identifier) {
  const value = cleanText(identifier, LIMITS.user.email);
  if (isEmailIdentifier(value)) return isValidEmail(value) ? value.toLowerCase() : null;
  const username = normalizeUsername(value);
  if (validateUsername(username)) return null;
  const snapshot = await getDoc(doc(db, COLLECTIONS.usernames, username));
  const email = snapshot.exists() ? snapshot.data().email : null;
  return typeof email === 'string' && isValidEmail(email) ? email : null;
}

export async function signIn(identifierInput, passwordInput) {
  const identifier = cleanText(identifierInput, LIMITS.user.email);
  const password = typeof passwordInput === 'string' ? passwordInput.slice(0, LIMITS.user.maxPassword) : '';
  const errors = {};
  if (!identifier) errors.identifier = 'Escriba su usuario.';
  if (!password) errors.password = 'Escriba su contraseña.';
  if (Object.keys(errors).length) throw new ValidationError(errors);

  try {
    const email = await resolveEmail(identifier);
    // Same message for unknown user and wrong password (does not reveal which accounts exist).
    if (!email) throw new AppError(WRONG_CREDENTIALS, { code: 'auth/invalid-credential' });
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    const appError = toAppError(error);
    if (appError.code === 'auth/invalid-credential' || appError.code === 'auth/user-not-found' || appError.code === 'auth/wrong-password') {
      throw new AppError(WRONG_CREDENTIALS, { code: appError.code, cause: error });
    }
    throw appError;
  }
}

export async function requestPasswordReset(identifierInput) {
  const identifier = cleanText(identifierInput, LIMITS.user.email);
  if (!identifier) {
    throw new ValidationError({ identifier: 'Escriba su usuario o correo para recuperar la contraseña.' });
  }
  try {
    const email = await resolveEmail(identifier);
    if (!email) return; // do not reveal whether the account exists
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') return;
    throw toAppError(error);
  }
}
