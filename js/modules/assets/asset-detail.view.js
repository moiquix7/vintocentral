/** Asset detail: photos, data, and edit/delete actions according to permissions. */
import { h, icon, mount, pageHeader } from '../../core/dom.js';
import { session } from '../../core/session.js';
import { navigate } from '../../core/router.js';
import { notify } from '../../core/notify.js';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../../shared/format.js';
import { assetStore } from './asset.store.js';
import { catalogLookups, catalogsReady } from '../catalogs/catalog.store.js';
import { availabilityBadge, conditionBadge, confirmDeleteAsset } from './asset-ui.js';
import { availabilityOf, isUnavailable } from './asset.model.js';
import { assetHistorySection } from '../history/history.timeline.js';

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
  if (await confirmDeleteAsset(asset, button)) navigate('/assets');
}

const yesNo = (value) => (value === true ? 'Sí' : 'No');

/** @param {HTMLElement | null} historyNode "Historial de cambios" card (admin/editor only) */
function draw(container, asset, historyNode) {
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
          detailRow('Marca', asset.brand),
          detailRow('Modelo', asset.model),
          detailRow('Nro. de serie', asset.serialNumber),
          detailRow('Empotrado', yesNo(asset.builtIn)),
          detailRow('Asegurado', yesNo(asset.insured)),
          detailRow('Tipo de artículo', catalogLookups.typeName(asset.typeId)),
          detailRow('Departamento', catalogLookups.categoryName(asset.categoryId)),
          detailRow('Ubicación', catalogLookups.locationName(asset.locationId)),
          detailRow('Estado', conditionBadge(asset.condition)),
          detailRow('Disponibilidad', availabilityBadge(asset)),
          isUnavailable(availabilityOf(asset)) ? detailRow('Motivo', asset.unavailableReason) : null,
          detailRow('Observaciones', asset.notes ? h('span', { class: 'pre-line' }, asset.notes) : ''),
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
    historyNode,
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
  // The history card is built once and kept across redraws; it reloads when the article changes.
  const history = session.can('history.view') ? assetHistorySection(initial.id) : null;
  let lastUpdate = initial.updatedAt?.toMillis?.() ?? 0;
  draw(container, initial, history?.node ?? null);
  // Live updates; if the asset disappears (deleted here or elsewhere) the delete flow / user navigates away.
  return assetStore.subscribe(() => {
    const asset = assetStore.getById(params.id);
    const update = asset?.updatedAt?.toMillis?.() ?? 0;
    if (asset && history && update !== lastUpdate) {
      lastUpdate = update;
      history.refresh();
    }
    if (asset) draw(container, asset, history?.node ?? null);
    else mount(container, pageHeader('Artículo eliminado', h('a', { href: '#/assets', class: 'btn btn-secondary' }, icon('back'), 'Volver')));
  });
}
