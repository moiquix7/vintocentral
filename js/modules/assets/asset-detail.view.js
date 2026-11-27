/** Asset detail: photos, data, and edit/delete actions according to permissions. */
import { h, icon, mount, pageHeader } from '../../core/dom.js';
import { session } from '../../core/session.js';
import { navigate } from '../../core/router.js';
import { notify, handleError } from '../../core/notify.js';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../../shared/format.js';
import { confirmDialog } from '../../shared/dialog.js';
import { assetStore } from './asset.store.js';
import { catalogLookups, catalogsReady } from '../catalogs/catalog.store.js';
import { deleteAsset } from './asset.service.js';
import { availabilityBadge, conditionBadge } from './asset-ui.js';

function detailRow(label, value) {
  return [h('dt', null, label), h('dd', null, value || '—')];
}

function gallery(photos) {
  if (!photos?.length) return h('p', { class: 'muted' }, 'Este artículo no tiene fotos.');
  return h(
    'ul',
    { class: 'gallery' },
    photos.map((photo, index) =>
      h(
        'li',
        null,
        h(
          'a',
          { href: photo.url, target: '_blank', rel: 'noopener noreferrer' },
          h('img', { src: photo.url, alt: `Foto ${index + 1} del artículo (abre en una pestaña nueva)`, loading: 'lazy' }),
        ),
      ),
    ),
  );
}

async function onDelete(asset, button) {
  const confirmed = await confirmDialog({
    title: 'Eliminar artículo',
    message: `¿Seguro que desea eliminar "${asset.name}"? Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
    danger: true,
  });
  if (!confirmed) return;
  button.disabled = true;
  try {
    await deleteAsset(asset);
    notify.success('Artículo eliminado.');
    navigate('/assets');
  } catch (error) {
    handleError(error, 'delete asset');
    button.disabled = false;
  }
}

function draw(container, asset) {
  const actions = [h('a', { href: '#/assets', class: 'btn btn-secondary' }, icon('back'), 'Volver')];
  if (session.can('assets.write')) {
    actions.push(h('a', { href: `#/assets/${encodeURIComponent(asset.id)}/edit`, class: 'btn btn-primary' }, icon('edit'), 'Editar'));
  }
  if (session.can('assets.delete')) {
    const remove = h('button', { type: 'button', class: 'btn btn-danger' }, icon('trash'), 'Eliminar');
    remove.addEventListener('click', () => onDelete(asset, remove));
    actions.push(remove);
  }

  mount(
    container,
    pageHeader(asset.name, ...actions),
    h(
      'div',
      { class: 'grid-2' },
      h('section', { class: 'card' }, h('h2', null, 'Fotos'), gallery(asset.photos)),
      h(
        'section',
        { class: 'card' },
        h('h2', null, 'Datos del artículo'),
        h(
          'dl',
          { class: 'details' },
          detailRow('Código', asset.code),
          detailRow('Categoría', catalogLookups.typeName(asset.typeId)),
          detailRow('Departamento', catalogLookups.categoryName(asset.categoryId)),
          detailRow('Ubicación', catalogLookups.locationName(asset.locationId)),
          detailRow('Estado', conditionBadge(asset.condition)),
          detailRow('Disponibilidad', availabilityBadge(asset)),
          detailRow('Cantidad', formatNumber(asset.quantity)),
          detailRow('Valor unitario', formatCurrency(asset.value)),
          detailRow('Valor total', formatCurrency((asset.value || 0) * (asset.quantity || 1))),
          detailRow('Fecha de adquisición', asset.acquisitionDate ? formatDate(asset.acquisitionDate) : ''),
          detailRow('Etiquetas', asset.tags?.length ? h('span', { class: 'tags' }, asset.tags.map((t) => h('span', { class: 'tag' }, t))) : ''),
          detailRow('Descripción', asset.description ? h('span', { class: 'pre-line' }, asset.description) : ''),
          detailRow('Última verificación', asset.checkedAt ? formatDateTime(asset.checkedAt) : 'Nunca'),
          detailRow('Última modificación', formatDateTime(asset.updatedAt)),
        ),
      ),
    ),
  );
}

export async function render(container, { params }) {
  await Promise.all([assetStore.whenReady(), catalogsReady()]);
  const initial = assetStore.getById(params.id);
  if (!initial) {
    notify.info('El artículo no existe o fue eliminado.');
    navigate('/assets');
    return undefined;
  }
  draw(container, initial);
  // Live updates; if the asset disappears (deleted here or elsewhere) the delete flow / user navigates away.
  return assetStore.subscribe(() => {
    const asset = assetStore.getById(params.id);
    if (asset) draw(container, asset);
    else mount(container, pageHeader('Artículo eliminado', h('a', { href: '#/assets', class: 'btn btn-secondary' }, icon('back'), 'Volver')));
  });
}
