/**
 * User administration (admin only).
 * Accounts are created with an isolated Auth instance so the admin stays signed in;
 * users/{uid} and usernames/{username} are written together in one batch (firestore.rules
 * checks both with getAfter()).
 */
import {
  db,
  auth,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  withIsolatedAuth,
} from '../../core/firebase.js';
import { session } from '../../core/session.js';
import { AppError, ValidationError, toAppError } from '../../core/errors.js';
import { COLLECTIONS } from '../../config/app-config.js';
import { sanitizeNewUser, validateNewUser, validateProfileChange } from './user.model.js';
import { cleanText } from '../../shared/validation.js';

export async function listUsers() {
  try {
    const snapshot = await getDocs(query(collection(db, COLLECTIONS.users), orderBy('displayName')));
    return snapshot.docs.map((d) => ({ uid: d.id, ...d.data() }));
  } catch (error) {
    throw toAppError(error);
  }
}

/** True when nobody owns the username yet (or `ownerUid` already owns it). */
export async function isUsernameAvailable(username, ownerUid = null) {
  const snapshot = await getDoc(doc(db, COLLECTIONS.usernames, username));
  return !snapshot.exists() || snapshot.data().uid === ownerUid;
}

export async function createUser(input) {
  const user = sanitizeNewUser(input);
  const errors = validateNewUser(user);
  if (Object.keys(errors).length) throw new ValidationError(errors);

  try {
    if (!(await isUsernameAvailable(user.username))) {
      throw new ValidationError({ username: 'Ese nombre de usuario ya está en uso.' });
    }
    const uid = await withIsolatedAuth(async (isolatedAuth) => {
      const credential = await createUserWithEmailAndPassword(isolatedAuth, user.email, user.password);
      await signOut(isolatedAuth);
      return credential.user.uid;
    });

    const batch = writeBatch(db);
    batch.set(doc(db, COLLECTIONS.usernames, user.username), { uid, email: user.email });
    batch.set(doc(db, COLLECTIONS.users, uid), {
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      departmentId: user.departmentId,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: session.user.uid,
    });
    await batch.commit();
    return uid;
  } catch (error) {
    throw toAppError(error);
  }
}

/**
 * Changes role, active flag and department (id from `categories`, '' = none).
 * @param {string} targetUid
 * @param {{ role: string, active: boolean, departmentId: string }} access
 */
export async function updateUserAccess(targetUid, { role, active, departmentId }) {
  const problem = validateProfileChange({ targetUid, currentUid: session.user.uid, role, active });
  if (problem) throw new AppError(problem, { code: 'app/self-lockout' });
  try {
    await updateDoc(doc(db, COLLECTIONS.users, targetUid), {
      role,
      active,
      departmentId: cleanText(departmentId, 64),
      updatedAt: serverTimestamp(),
      updatedBy: session.user.uid,
    });
  } catch (error) {
    throw toAppError(error);
  }
}

export async function sendPasswordReset(email) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw toAppError(error);
  }
}
