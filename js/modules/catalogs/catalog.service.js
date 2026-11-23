/**
 * Generic CRUD for small catalogs (categories = departments, locations).
 * One factory, two instances: same behaviour, different collection.
 */
import {
  db,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  limit,
  serverTimestamp,
  deleteField,
} from '../../core/firebase.js';
import { session } from '../../core/session.js';
import { AppError, ValidationError, toAppError } from '../../core/errors.js';
import { COLLECTIONS } from '../../config/app-config.js';
import { sanitizeCatalogItem, validateCatalogItem, sortLeaders } from './catalog.model.js';
import { categoryStore, locationStore } from './catalog.store.js';

/** Fields of the short-lived single-leader version; removed on the first edit. */
const LEGACY_DEPARTMENT_FIELDS = Object.freeze(['leader', 'term']);

/**
 * @param {{ collectionName: string, usageField: string, store: object, withLeader?: boolean }} config
 *   usageField: asset field that references this catalog (used to block deleting items in use)
 *   withLeader: departments also store the leader history (name + gestión years)
 */
function createCatalogService({ collectionName, usageField, store, withLeader = false }) {
  function prepare(input, currentId) {
    const item = sanitizeCatalogItem(input, { withLeader });
    const errors = validateCatalogItem(item, store.getAll(), currentId);
    if (Object.keys(errors).length) throw new ValidationError(errors);
    if (item.leaders) item.leaders = sortLeaders(item.leaders);
    return { ...item, updatedAt: serverTimestamp(), updatedBy: session.user.uid };
  }

  return Object.freeze({
    async create(input) {
      const data = prepare(input, null);
      try {
        const reference = doc(collection(db, collectionName));
        await setDoc(reference, { ...data, createdAt: serverTimestamp() });
        return reference.id;
      } catch (error) {
        throw toAppError(error);
      }
    },

    async update(id, input) {
      const data = prepare(input, id);
      if (withLeader) LEGACY_DEPARTMENT_FIELDS.forEach((key) => (data[key] = deleteField()));
      try {
        await updateDoc(doc(db, collectionName, id), data);
      } catch (error) {
        throw toAppError(error);
      }
    },

    async remove(id) {
      try {
        const inUse = await getDocs(query(collection(db, COLLECTIONS.assets), where(usageField, '==', id), limit(1)));
        if (!inUse.empty) {
          throw new AppError('No se puede eliminar: hay bienes que lo usan. Cámbielos primero.', { code: 'app/in-use' });
        }
        await deleteDoc(doc(db, collectionName, id));
      } catch (error) {
        throw toAppError(error);
      }
    },
  });
}

export const categoryService = createCatalogService({
  collectionName: COLLECTIONS.categories,
  usageField: 'categoryId',
  store: categoryStore,
  withLeader: true,
});

export const locationService = createCatalogService({
  collectionName: COLLECTIONS.locations,
  usageField: 'locationId',
  store: locationStore,
});
