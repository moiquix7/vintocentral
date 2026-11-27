/**
 * Live catalogs, plus id → name lookups used across modules.
 * categoryStore = "Departamentos" (collection `categories`), assetTypeStore = "Categorías" (`assetTypes`).
 */
import { createCollectionStore } from '../../core/collection-store.js';
import { COLLECTIONS } from '../../config/app-config.js';

export const categoryStore = createCollectionStore(COLLECTIONS.categories, { orderByField: 'name' });
export const assetTypeStore = createCollectionStore(COLLECTIONS.assetTypes, { orderByField: 'name' });
export const locationStore = createCollectionStore(COLLECTIONS.locations, { orderByField: 'name' });

export const CATALOG_STORES = Object.freeze([assetTypeStore, categoryStore, locationStore]);

/** Resolves when every catalog has its first snapshot. */
export function catalogsReady() {
  return Promise.all(CATALOG_STORES.map((store) => store.whenReady()));
}

export const catalogLookups = Object.freeze({
  typeName: (id) => assetTypeStore.getById(id)?.name ?? 'Sin categoría',
  categoryName: (id) => categoryStore.getById(id)?.name ?? 'Sin departamento',
  locationName: (id) => locationStore.getById(id)?.name ?? 'Sin ubicación',
});

/** { id: name } for a <select>. */
export function catalogOptions(store) {
  return Object.fromEntries(store.getAll().map((item) => [item.id, item.name]));
}
