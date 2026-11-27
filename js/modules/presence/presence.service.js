/**
 * Connected users ("presence/{uid}" = { displayName, lastSeen }).
 * - startPresence(): heartbeat every PRESENCE.heartbeatMs while the tab is visible, and once more when
 *   it becomes visible again. Removes its document before sign-out (session.beforeSignOut).
 * - watchPresence(): live list of connected users for the dashboard (admin/editor may read).
 * Failures never interrupt the user: presence is informative only.
 */
import { db, collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from '../../core/firebase.js';
import { session } from '../../core/session.js';
import { COLLECTIONS, LIMITS, PRESENCE } from '../../config/app-config.js';
import { cleanText } from '../../shared/validation.js';
import { connectedUsers } from './presence.model.js';

let timer = 0;
let uid = null;
let unregisterSignOut = null;

function presenceDoc(id) {
  return doc(db, COLLECTIONS.presence, id);
}

async function beat() {
  if (!uid || document.visibilityState !== 'visible') return;
  const displayName = cleanText(session.profile?.displayName ?? '', LIMITS.user.displayName) || 'Usuario';
  try {
    await setDoc(presenceDoc(uid), { displayName, lastSeen: serverTimestamp() });
  } catch (error) {
    console.warn('[VintoCentral] presence heartbeat failed', error);
  }
}

function onVisibility() {
  if (document.visibilityState === 'visible') beat();
}

async function removeOwn() {
  const id = uid;
  stopPresence();
  if (id) await deleteDoc(presenceDoc(id));
}

/** Starts the heartbeat for the signed-in user (idempotent). */
export function startPresence() {
  const current = session.user?.uid ?? null;
  if (!current || current === uid) return;
  stopPresence();
  uid = current;
  beat();
  timer = setInterval(beat, PRESENCE.heartbeatMs);
  document.addEventListener('visibilitychange', onVisibility);
  unregisterSignOut = session.beforeSignOut(removeOwn);
}

/** Stops the heartbeat (the document ages out by itself after PRESENCE.onlineWindowMs). */
export function stopPresence() {
  clearInterval(timer);
  timer = 0;
  uid = null;
  document.removeEventListener('visibilitychange', onVisibility);
  unregisterSignOut?.();
  unregisterSignOut = null;
}

/**
 * Calls `onChange(users)` with the connected users now, on every change and every minute
 * (a user drops out when their last heartbeat gets too old, even without a new snapshot).
 * `users` is null when the list cannot be read.
 * @param {(users: Array<{ id: string, displayName: string }> | null) => void} onChange
 * @returns {() => void} stop
 */
export function watchPresence(onChange) {
  let entries = [];
  const emit = () => onChange(connectedUsers(entries, Date.now(), PRESENCE.onlineWindowMs));
  const ticker = setInterval(emit, 60 * 1000);
  const stopSnapshot = onSnapshot(
    collection(db, COLLECTIONS.presence),
    (snapshot) => {
      entries = snapshot.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
      emit();
    },
    (error) => {
      // e.g. rules not published yet: the dashboard shows "no disponible" instead of a toast.
      console.warn('[VintoCentral] presence snapshot failed', error);
      clearInterval(ticker);
      onChange(null);
    },
  );
  return () => {
    stopSnapshot();
    clearInterval(ticker);
  };
}
