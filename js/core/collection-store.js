/**
 * Live, in-memory copy of a Firestore collection (church inventories are small, so the whole
 * collection fits comfortably in memory and search/filter/sort run instantly on the client).
 */
import { db, collection, query, orderBy, onSnapshot } from './firebase.js';
import { handleError } from './notify.js';

/**
 * @param {string} collectionName
 * @param {{ orderByField: string }} options
 */
export function createCollectionStore(collectionName, { orderByField }) {
  let items = [];
  let byId = new Map();
  let unsubscribe = null;
  let ready = false;
  let readyPromise = null;
  let resolveReady = () => {};
  const listeners = new Set();

  function emit() {
    for (const listener of listeners) {
      try {
        listener(items);
      } catch (error) {
        handleError(error, `${collectionName} listener`);
      }
    }
  }

  function markReady() {
    ready = true;
    resolveReady();
  }

  return Object.freeze({
    start() {
      if (unsubscribe) return;
      ready = false;
      readyPromise = new Promise((resolve) => (resolveReady = resolve));
      unsubscribe = onSnapshot(
        query(collection(db, collectionName), orderBy(orderByField)),
        (snapshot) => {
          items = snapshot.docs.map((d) => Object.freeze({ id: d.id, ...d.data() }));
          byId = new Map(items.map((item) => [item.id, item]));
          markReady();
          emit();
        },
        (error) => {
          handleError(error, `${collectionName} snapshot`);
          markReady();
        },
      );
    },
    stop() {
      unsubscribe?.();
      unsubscribe = null;
      items = [];
      byId = new Map();
      ready = false;
      resolveReady();
    },
    /** Resolves after the first snapshot (or immediately if not started). */
    whenReady() {
      return ready || !readyPromise ? Promise.resolve() : readyPromise;
    },
    getAll() {
      return items;
    },
    getById(id) {
      return byId.get(id) ?? null;
    },
    /** @returns {() => void} unsubscribe */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
