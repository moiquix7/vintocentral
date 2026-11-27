/** Small pieces shared by the asset views (and the inventory grid): badges, thumbnail, delete flow. */
import { h, icon } from '../../core/dom.js';
import { notify, handleError } from '../../core/notify.js';
import { AVAILABILITY, CONDITIONS } from '../../config/app-config.js';
import { confirmDialog } from '../../shared/dialog.js';
import { availabilityOf } from './asset.model.js';
import { deleteAsset } from './asset.service.js';

/**
 * Asks for confirmation and deletes the article (admin only: `assets.delete`, also enforced by the rules).
 * @param {object} asset
 * @param {HTMLButtonElement} [button] disabled while deleting
 * @returns {Promise<boolean>} true when the article was deleted
 */
export async function confirmDeleteAsset(asset, button) {
  const confirmed = await confirmDialog({
    title: 'Eliminar artículo',
    message: `¿Seguro que desea eliminar "${asset.name}"? Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
    danger: true,
  });
  if (!confirmed) return false;
  if (button) button.disabled = true;
  try {
    await deleteAsset(asset);
    notify.success('Artículo eliminado.');
    return true;
  } catch (error) {
    handleError(error, 'delete asset');
    if (button) button.disabled = false;
    return false;
  }
}

export function conditionBadge(condition) {
  return h('span', { class: `badge badge--${condition}` }, CONDITIONS[condition] ?? '—');
}

export function availabilityBadge(asset) {
  const availability = availabilityOf(asset);
  return h('span', { class: `badge badge--${availability}` }, AVAILABILITY[availability]);
}

export function thumbnail(asset, size = 56) {
  const photo = asset.photos?.[0];
  if (!photo?.url) return h('span', { class: 'thumb thumb--empty', 'aria-hidden': 'true' }, icon('image'));
  return h('img', { class: 'thumb', src: photo.url, alt: '', width: String(size), height: String(size), loading: 'lazy' });
}
