/**
 * Generic CRUD for small catalogs (categories, locations).
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
} from '../../core/firebase.js';
import { session } from '../../core/session.js';
import { AppError, ValidationError, toAppError } from '../../core/errors.js';
import { COLLECTIONS } from '../../config/app-config.js';
import { sanitizeCatalogItem, validateCatalogItem } from './catalog.model.js';
import { categoryStore, locationStore } from './catalog.store.js';

/**
 * @param {{ collectionName: string, usageField: string, store: object }} config
 *   usageField: asset field that references this catalog (used to block deleting items in use)
 */
function createCatalogService({ collectionName, usageField, store }) {
  function prepare(input, currentId) {
    const item = sanitizeCatalogItem(input);
    const errors = validateCatalogItem(item, store.getAll(), currentId);
    if (Object.keys(errors).length) throw new ValidationError(errors);
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
});

export const locationService = createCatalogService({
  collectionName: COLLECTIONS.locations,
  usageField: 'locationId',
  store: locationStore,
});
