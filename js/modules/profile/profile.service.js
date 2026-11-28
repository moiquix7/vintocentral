/**
 * The signed-in user's own profile: name, username, phone, photo, email and password.
 * Only these fields can be self-edited (firestore.rules → validSelfUpdate); role/active/department cannot.
 * Email change: Firebase sends a verification link (verifyBeforeUpdateEmail); once the Auth email has
 * changed, syncEmail() copies it to users/{uid} and usernames/{username} on the next sign-in.
 */
import {
  auth,
  db,
  storage,
  doc,
  serverTimestamp,
  writeBatch,
  storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  verifyBeforeUpdateEmail,
} from '../../core/firebase.js';
import { session } from '../../core/session.js';
import { AppError, ValidationError, toAppError, isNotFound } from '../../core/errors.js';
import { COLLECTIONS } from '../../config/app-config.js';
import { sanitizeProfileUpdate, validateProfileUpdate, validatePasswordChange, validateEmailChange } from '../users/user.model.js';
import { isUsernameAvailable } from '../users/user.service.js';

const PASSWORD_MESSAGES = Object.freeze({
  'auth/invalid-credential': 'La contraseña actual no es correcta.',
  'auth/wrong-password': 'La contraseña actual no es correcta.',
  'auth/requires-recent-login': 'Por seguridad, salga e ingrese de nuevo antes de cambiar la contraseña.',
});

const EMAIL_MESSAGES = Object.freeze({
  'auth/invalid-credential': ['emailPassword', 'La contraseña actual no es correcta.'],
  'auth/wrong-password': ['emailPassword', 'La contraseña actual no es correcta.'],
  'auth/email-already-in-use': ['newEmail', 'Ya existe una cuenta con ese correo.'],
  'auth/invalid-email': ['newEmail', 'El correo electrónico no es válido.'],
  'auth/invalid-new-email': ['newEmail', 'El correo electrónico no es válido.'],
});

function currentUserOrThrow() {
  const user = auth.currentUser;
  if (!user || !session.profile) throw new AppError('Su sesión terminó. Vuelva a ingresar.', { code: 'unauthenticated' });
  return user;
}

async function removeStoredPhoto(path) {
  if (!path) return;
  try {
    await deleteObject(storageRef(storage, path));
  } catch (error) {
    if (!isNotFound(error)) console.warn('[VintoCentral] old profile photo not removed', error);
  }
}

/**
 * Saves name, username and phone; optionally replaces or removes the photo.
 * @param {{ displayName: string, username: string, phone: string }} input
 * @param {{ newPhoto?: Blob|null, removePhoto?: boolean }} photoChange
 */
export async function updateProfile(input, { newPhoto = null, removePhoto = false } = {}) {
  const user = currentUserOrThrow();
  const profile = sanitizeProfileUpdate(input);
  const errors = validateProfileUpdate(profile);
  if (Object.keys(errors).length) throw new ValidationError(errors);

  const previous = session.profile;
  const usernameChanged = profile.username !== previous.username;
  let uploadedPath = null;

  try {
    if (usernameChanged && !(await isUsernameAvailable(profile.username, user.uid))) {
      throw new ValidationError({ username: 'Ese nombre de usuario ya está en uso.' });
    }

    const changes = {
      displayName: profile.displayName,
      username: profile.username,
      phone: profile.phone,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    };

    if (newPhoto) {
      uploadedPath = `profiles/${user.uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const reference = storageRef(storage, uploadedPath);
      await uploadBytes(reference, newPhoto, { contentType: 'image/jpeg' });
      changes.photoUrl = await getDownloadURL(reference);
      changes.photoPath = uploadedPath;
    } else if (removePhoto) {
      changes.photoUrl = '';
      changes.photoPath = '';
    }

    const batch = writeBatch(db);
    if (usernameChanged) {
      batch.set(doc(db, COLLECTIONS.usernames, profile.username), { uid: user.uid, email: user.email });
      if (previous.username) batch.delete(doc(db, COLLECTIONS.usernames, previous.username));
    }
    batch.update(doc(db, COLLECTIONS.users, user.uid), changes);
    await batch.commit();
  } catch (error) {
    if (uploadedPath) await removeStoredPhoto(uploadedPath);
    throw toAppError(error);
  }

  if ((newPhoto || removePhoto) && previous.photoPath) await removeStoredPhoto(previous.photoPath);
}

/**
 * Sends a verification link to the new email. The Auth email changes only when the link is opened.
 * @param {{ newEmail: string, currentPassword: string }} input
 */
export async function requestEmailChange({ newEmail, currentPassword }) {
  const user = currentUserOrThrow();
  const { email, errors } = validateEmailChange({ newEmail, currentEmail: user.email, currentPassword });
  if (Object.keys(errors).length) throw new ValidationError(errors);
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
    await verifyBeforeUpdateEmail(user, email);
  } catch (error) {
    const known = EMAIL_MESSAGES[error?.code];
    if (known) throw new ValidationError({ [known[0]]: known[1] }, known[1]);
    throw toAppError(error);
  }
  return email;
}

/**
 * After a verified email change, the Auth email differs from the stored one: copy it to the profile
 * and to the username index (one batch; the rules only accept the Auth email). Best effort: a failure is
 * logged and retried on the next sign-in.
 */
export async function syncEmail() {
  const user = auth.currentUser;
  const profile = session.profile;
  if (!user?.email || !profile || user.uid !== profile.uid) return;
  const email = user.email.toLowerCase();
  if (email === String(profile.email ?? '').toLowerCase()) return;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTIONS.users, user.uid), { email, updatedAt: serverTimestamp(), updatedBy: user.uid });
    if (profile.username) batch.update(doc(db, COLLECTIONS.usernames, profile.username), { email });
    await batch.commit();
  } catch (error) {
    console.warn('[VintoCentral] email sync failed (retried on next sign-in)', error);
  }
}

export async function changePassword(input) {
  const user = currentUserOrThrow();
  const errors = validatePasswordChange(input);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, input.currentPassword));
    await updatePassword(user, input.newPassword);
  } catch (error) {
    const message = PASSWORD_MESSAGES[error?.code];
    if (message === PASSWORD_MESSAGES['auth/wrong-password']) {
      throw new ValidationError({ currentPassword: message }, message);
    }
    throw message ? new AppError(message, { code: error.code, cause: error }) : toAppError(error);
  }
}
