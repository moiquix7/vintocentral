/**
 * Session state: the Firebase user plus the profile document users/{uid} (role, active).
 * A user without an active profile is signed out immediately.
 * The profile is watched live, so a role change or deactivation applies without reloading.
 */
import { auth, db, doc, onSnapshot, onAuthStateChanged, signOut } from './firebase.js';
import { COLLECTIONS, PERMISSIONS_BY_ROLE } from '../config/app-config.js';
import { notify, handleError } from './notify.js';

let state = Object.freeze({ user: null, profile: null });
const listeners = new Set();
let stopProfile = null;

function setState(user, profile) {
  state = Object.freeze({ user, profile });
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (error) {
      handleError(error, 'session listener');
    }
  }
}

export const session = Object.freeze({
  get user() {
    return state.user;
  },
  get profile() {
    return state.profile;
  },
  get isAuthenticated() {
    return Boolean(state.user && state.profile);
  },
  can(permission) {
    const role = state.profile?.role;
    return Boolean(role && PERMISSIONS_BY_ROLE[role]?.includes(permission));
  },
  /** @returns {() => void} unsubscribe */
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
});

/**
 * Explains why a profile document does not grant access (null when it is valid).
 * The message includes the uid so the administrator can compare it with the document id.
 */
function profileProblem(uid, exists, data) {
  if (!exists) {
    return `No existe el perfil de su cuenta. El administrador debe crear en Firestore el documento users/${uid}.`;
  }
  if (data.active !== true) {
    return `Su cuenta está desactivada. En users/${uid}, el campo "active" debe ser de tipo boolean con valor true.`;
  }
  if (!Object.hasOwn(PERMISSIONS_BY_ROLE, data.role)) {
    return `Rol no válido (${JSON.stringify(data.role ?? null)}). En users/${uid}, "role" debe ser admin, editor o viewer.`;
  }
  return null;
}

/**
 * Stops live listeners first (so they do not fail with permission errors), clears the state,
 * then signs out of Firebase.
 */
export async function endSession() {
  stopProfile?.();
  stopProfile = null;
  if (state.user || state.profile) setState(null, null);
  try {
    await signOut(auth);
  } catch (error) {
    handleError(error, 'signOut');
  }
}

function watchProfile(user, onSettled) {
  stopProfile = onSnapshot(
    doc(db, COLLECTIONS.users, user.uid),
    (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() : null;
      const problem = profileProblem(user.uid, snapshot.exists(), data);
      if (problem) {
        console.warn('[VintoCentral] profile rejected', { uid: user.uid, fields: data ? Object.keys(data) : null });
        notify.error(problem);
        endSession().finally(onSettled);
        return;
      }
      setState(user, {
        uid: user.uid,
        email: data.email,
        username: typeof data.username === 'string' ? data.username : '',
        displayName: data.displayName || data.username || data.email,
        role: data.role,
        photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : '',
        photoPath: typeof data.photoPath === 'string' ? data.photoPath : '',
      });
      onSettled();
    },
    (error) => {
      handleError(error, 'profile');
      endSession().finally(onSettled);
    },
  );
}

/** Starts listening to Firebase Auth. Resolves once the initial session state is known. */
export function startSession() {
  return new Promise((resolve) => {
    let settled = false;
    const settle = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    onAuthStateChanged(
      auth,
      (user) => {
        stopProfile?.();
        stopProfile = null;
        if (!user) {
          if (state.user || state.profile) setState(null, null);
          settle();
          return;
        }
        watchProfile(user, settle);
      },
      (error) => {
        handleError(error, 'auth');
        settle();
      },
    );
  });
}
