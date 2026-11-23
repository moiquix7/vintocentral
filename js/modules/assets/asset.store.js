/** Live list of assets shared by the asset list, dashboard and reports. */
import { createCollectionStore } from '../../core/collection-store.js';
import { COLLECTIONS } from '../../config/app-config.js';

export const assetStore = createCollectionStore(COLLECTIONS.assets, { orderByField: 'name' });
