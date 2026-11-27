/**
 * Change history persistence (assetHistory). Entries are only added inside the batch that writes the
 * article (asset.service.js), so an entry never exists without its change and vice versa.
 */
import { db, collection, doc, getDocs, query, where, orderBy, limit, serverTimestamp } from '../../core/firebase.js';
import { toAppError } from '../../core/errors.js';
import { COLLECTIONS } from '../../config/app-config.js';
import { sanitizeHistoryEntry, sortChronological } from './history.model.js';

const historyCollection = () => collection(db, COLLECTIONS.assetHistory);

function entriesOf(snapshot) {
  return snapshot.docs.map((d) => Object.freeze({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
}

/**
 * Adds one history entry to a write batch (stamped with the server time of the batch).
 * @param {import('../../core/firebase.js').WriteBatch} batch
 * @param {{ assetId: string, assetName: string, action: string, changes: Array<object>, by: string, byName: string }} entry
 */
export function addHistoryToBatch(batch, entry) {
  batch.set(doc(historyCollection()), { ...sanitizeHistoryEntry(entry), at: serverTimestamp() });
}

/** All entries of one article, oldest first. */
export async function listAssetHistory(assetId) {
  try {
    return sortChronological(entriesOf(await getDocs(query(historyCollection(), where('assetId', '==', assetId)))));
  } catch (error) {
    throw toAppError(error);
  }
}

/**
 * The latest `count` entries of all articles, newest first.
 * @returns {Promise<{ entries: Array<object>, hasMore: boolean }>}
 */
export async function listRecentHistory(count) {
  try {
    const snapshot = await getDocs(query(historyCollection(), orderBy('at', 'desc'), limit(count)));
    return { entries: entriesOf(snapshot), hasMore: snapshot.size === count };
  } catch (error) {
    throw toAppError(error);
  }
}
