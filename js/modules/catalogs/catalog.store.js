/** Live categories and locations, plus id → name lookups used across modules. */
import { createCollectionStore } from '../../core/collection-store.js';
import { COLLECTIONS } from '../../config/app-config.js';

export const categoryStore = createCollectionStore(COLLECTIONS.categories, { orderByField: 'name' });
export const locationStore = createCollectionStore(COLLECTIONS.locations, { orderByField: 'name' });

export const catalogLookups = Object.freeze({
  categoryName: (id) => categoryStore.getById(id)?.name ?? 'Sin departamento',
  locationName: (id) => locationStore.getById(id)?.name ?? 'Sin ubicación',
});
