/**
 * The ONLY module that imports the Firebase SDK from the CDN.
 * To upgrade Firebase, change the version in the URLs below (all must match).
 */
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { firebaseConfig } from '../config/firebase-config.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

auth.languageCode = 'es';

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

export {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

/**
 * Runs `task` with a temporary, isolated Auth instance and disposes it afterwards.
 * Used by the admin to create accounts: creating a user on the main instance would
 * sign the admin out and sign the new user in.
 */
export async function withIsolatedAuth(task) {
  const isolatedApp = initializeApp(firebaseConfig, `isolated-${Date.now()}`);
  try {
    return await task(getAuth(isolatedApp));
  } finally {
    await deleteApp(isolatedApp).catch(() => {});
  }
}
