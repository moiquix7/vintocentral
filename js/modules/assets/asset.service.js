/**
 * Asset persistence: Firestore document + photos in Storage (assets/{assetId}/...).
 * Uploads happen before the document write; if the write fails, the new uploads are removed,
 * so Storage never keeps orphan photos.
 * Every write also adds a change-history entry in the same batch (history.service.js), so the
 * article and its history always agree.
 */
import {
  db,
  storage,
  collection,
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
  storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from '../../core/firebase.js';
import { session } from '../../core/session.js';
import { AppError, ValidationError, toAppError, isNotFound } from '../../core/errors.js';
import { COLLECTIONS, LIMITS } from '../../config/app-config.js';
import {
  sanitizeAsset,
  validateAsset,
  sanitizePhotos,
  sanitizeInventoryUpdate,
  validateInventoryUpdate,
} from './asset.model.js';
import { catalogLookups } from '../catalogs/catalog.store.js';
import { addHistoryToBatch } from '../history/history.service.js';
import { diffAssets } from '../history/history.model.js';

function prepare(input) {
  const asset = sanitizeAsset(input);
  const errors = validateAsset(asset);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return asset;
}

function checkPhotoCount(count) {
  if (count > LIMITS.asset.photos) {
    throw new AppError(`Máximo ${LIMITS.asset.photos} fotos por artículo.`, { code: 'app/photo-limit' });
  }
}

/** Who is writing, for the history entry. */
function author() {
  return { by: session.user.uid, byName: session.profile?.displayName ?? '' };
}

/** Current stored article; a missing one is reported as a friendly error. */
async function requireAsset(id) {
  const current = await getAsset(id);
  if (!current) throw new AppError('El artículo no existe o fue eliminado.', { code: 'app/not-found' });
  return current;
}

async function uploadPhoto(assetId, blob) {
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const path = `${COLLECTIONS.assets}/${assetId}/${name}`;
  const reference = storageRef(storage, path);
  await uploadBytes(reference, blob, { contentType: 'image/jpeg' });
  return { path, url: await getDownloadURL(reference) };
}

async function uploadAll(assetId, blobs) {
  const uploaded = [];
  try {
    for (const blob of blobs) uploaded.push(await uploadPhoto(assetId, blob));
    return uploaded;
  } catch (error) {
    await removePhotos(uploaded);
    throw error;
  }
}

/** Best effort: a photo that is already gone is not an error. */
async function removePhotos(photos) {
  const results = await Promise.allSettled(photos.map((p) => deleteObject(storageRef(storage, p.path))));
  results
    .filter((r) => r.status === 'rejected' && !isNotFound(r.reason))
    .forEach((r) => console.warn('[VintoCentral] photo cleanup failed', r.reason));
}

export async function getAsset(id) {
  try {
    const snapshot = await getDoc(doc(db, COLLECTIONS.assets, id));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  } catch (error) {
    throw toAppError(error);
  }
}

/**
 * @param {object} input raw form values
 * @param {Blob[]} newPhotos compressed JPEG blobs
 * @returns {Promise<string>} new asset id
 */
export async function createAsset(input, newPhotos = []) {
  const asset = prepare(input);
  checkPhotoCount(newPhotos.length);
  const reference = doc(collection(db, COLLECTIONS.assets));
  let photos = [];
  try {
    photos = await uploadAll(reference.id, newPhotos);
    const uid = session.user.uid;
    const batch = writeBatch(db);
    batch.set(reference, {
      ...asset,
      photos,
      createdAt: serverTimestamp(),
      createdBy: uid,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
    addHistoryToBatch(batch, { assetId: reference.id, assetName: asset.name, action: 'create', changes: [], ...author() });
    await batch.commit();
    return reference.id;
  } catch (error) {
    await removePhotos(photos);
    throw toAppError(error);
  }
}

/**
 * @param {string} id
 * @param {object} input raw form values
 * @param {{ keptPhotos: Array<{path: string, url: string}>, removedPhotos: Array<{path: string}>, newPhotos: Blob[] }} photoChanges
 */
export async function updateAsset(id, input, { keptPhotos = [], removedPhotos = [], newPhotos = [] } = {}) {
  const asset = prepare(input);
  const kept = sanitizePhotos(keptPhotos);
  checkPhotoCount(kept.length + newPhotos.length);
  let uploaded = [];
  try {
    const before = await requireAsset(id);
    uploaded = await uploadAll(id, newPhotos);
    const data = { ...asset, photos: [...kept, ...uploaded] };
    const changes = diffAssets(before, data, catalogLookups);
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTIONS.assets, id), { ...data, updatedAt: serverTimestamp(), updatedBy: session.user.uid });
    // Saving without real changes is not worth a history entry.
    if (changes.length) addHistoryToBatch(batch, { assetId: id, assetName: asset.name, action: 'update', changes, ...author() });
    await batch.commit();
  } catch (error) {
    await removePhotos(uploaded);
    throw toAppError(error);
  }
  await removePhotos(removedPhotos);
}

/**
 * Inventory-taking: saves location, condition, availability, its reason and the notes, and marks the
 * article as verified now (checkedAt). Nothing else in the document changes.
 * @param {string} id
 * @param {{ locationId: string, condition: string, availability: string, unavailableReason?: string, notes?: string }} input
 */
export async function checkAsset(id, input) {
  const update = sanitizeInventoryUpdate(input);
  const errors = validateInventoryUpdate(update);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  try {
    const before = await requireAsset(id);
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTIONS.assets, id), {
      ...update,
      checkedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: session.user.uid,
    });
    // Logged even without changes: "verified on this date by this person" is itself worth auditing.
    const changes = diffAssets(before, update, catalogLookups);
    addHistoryToBatch(batch, { assetId: id, assetName: before.name, action: 'check', changes, ...author() });
    await batch.commit();
  } catch (error) {
    throw toAppError(error);
  }
}

/**
 * Deletes the document first (so the asset disappears even if photo cleanup fails), then its photos.
 * The history keeps a "deleted" entry with the article's name.
 */
 * Inventory-taking: saves location, condition and availability, and marks the article as verified now
 * (checkedAt). Nothing else in the document changes.
 * @param {string} id
 * @param {{ locationId: string, condition: string, availability: string }} input
 */
export async function checkAsset(id, input) {
  const update = sanitizeInventoryUpdate(input);
  const errors = validateInventoryUpdate(update);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  try {
    await updateDoc(doc(db, COLLECTIONS.assets, id), {
      ...update,
      checkedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: session.user.uid,
    });
  } catch (error) {
    throw toAppError(error);
  }
}

/** Deletes the document first (so the asset disappears even if photo cleanup fails), then its photos. */
export async function deleteAsset(asset) {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.assets, asset.id));
    addHistoryToBatch(batch, { assetId: asset.id, assetName: asset.name, action: 'delete', changes: [], ...author() });
    await batch.commit();
  } catch (error) {
    throw toAppError(error);
  }
  await removePhotos(sanitizePhotos(asset.photos));
}
