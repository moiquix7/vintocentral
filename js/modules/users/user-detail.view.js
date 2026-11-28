/**
 * User detail (#/users/:uid, admin only): account data, the articles the person registered and the
 * ones they modified last (from the in-memory asset store, no extra reads), and a link to the
 * change history filtered by their name. Same actions as the list (Editar, Desactivar…).
 */
import { h, icon, inventoryLoader, mount, pageHeader } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
import { notify, handleError } from '../../core/notify.js';
import { ROLES } from '../../config/app-config.js';
import { avatar } from '../../shared/avatar.js';
import { formatDateTime, formatNumber } from '../../shared/format.js';
import { getUser } from './user.service.js';
import { NO_DEPARTMENT, statusBadge, userActionButtons } from './user-actions.js';
import { assetStore } from '../assets/asset.store.js';
import { catalogLookups, catalogsReady } from '../catalogs/catalog.store.js';

const LIST_LIMIT = 20;

function detailRow(label, value) {
  return [h('dt', null, label), h('dd', null, value || '—')];
}

/** Newest change first. */
const byUpdatedDesc = (a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0);

function assetList(title, assets, emptyText) {
  const shown = [...assets].sort(byUpdatedDesc).slice(0, LIST_LIMIT);
  return h(
    'section',
    { class: 'card' },
    h('h2', null, `${title} (${formatNumber(assets.length)})`),
    assets.length
      ? h(
          'ul',
          { class: 'plain-list' },
          shown.map((asset) =>
            h(
              'li',
              null,
              h('a', { href: `#/assets/${encodeURIComponent(asset.id)}`, class: 'row-link' }, asset.name),
              h('small', { class: 'muted block' }, `${catalogLookups.locationName(asset.locationId)} · modificado ${formatDateTime(asset.updatedAt)}`),
            ),
          ),
        )
      : h('p', { class: 'muted' }, emptyText),
    assets.length > LIST_LIMIT ? h('p', { class: 'hint' }, `Se muestran los ${LIST_LIMIT} modificados más recientemente.`) : null,
  );
}

function draw(container, user, reload) {
  const assets = assetStore.getAll();
  const registered = assets.filter((asset) => asset.createdBy === user.uid);
  const modified = assets.filter((asset) => asset.updatedBy === user.uid);
  const historyHref = `#/history?texto=${encodeURIComponent(user.displayName)}`;

  mount(
    container,
    pageHeader(user.displayName, h('a', { href: '#/users', class: 'btn btn-secondary' }, icon('back'), 'Usuarios')),
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'person person--large' }, avatar(user, { size: 72 }), h('div', null, h('h2', null, user.displayName), statusBadge(user))),
      h(
        'dl',
        { class: 'details' },
        detailRow('Nombre de usuario', user.username ? `@${user.username}` : ''),
        detailRow('Correo electrónico', user.email ? h('a', { href: `mailto:${user.email}` }, user.email) : ''),
        detailRow('Teléfono', user.phone ? h('a', { href: `tel:${user.phone.replace(/[^\d+]/g, '')}` }, user.phone) : ''),
        detailRow('Rol', ROLES[user.role]),
        detailRow('Estado', statusBadge(user)),
        detailRow('Departamento', user.departmentId ? catalogLookups.categoryName(user.departmentId) : NO_DEPARTMENT),
        detailRow('Cuenta creada', formatDateTime(user.createdAt)),
        detailRow('Última modificación', formatDateTime(user.updatedAt)),
      ),
      h('div', { class: 'stack-tight' }, userActionButtons(user, reload), h('a', { href: historyHref, class: 'btn btn-link' }, icon('clock'), 'Ver sus cambios en el Historial')),
    ),
    h(
      'div',
      { class: 'grid-2' },
      assetList('Artículos que registró', registered, 'No registró artículos.'),
      assetList('Artículos que modificó por última vez', modified, 'No es la última persona que modificó algún artículo.'),
    ),
  );
}

export async function render(container, { params }) {
  mount(container, inventoryLoader({ label: 'Cargando usuario…' }));
  await Promise.all([assetStore.whenReady(), catalogsReady()]);
  let disposed = false;
  let user = null;

  async function load() {
    try {
      user = await getUser(params.uid);
    } catch (error) {
      handleError(error, 'get user');
      if (!disposed) navigate('/users');
      return;
    }
    if (disposed) return;
    if (!user) {
      notify.info('El usuario no existe.');
      navigate('/users');
      return;
    }
    draw(container, user, load);
  }

  await load();
  // Article counts follow live changes; the user document is reloaded after each action.
  const unsubscribe = assetStore.subscribe(() => user && !disposed && draw(container, user, load));
  return () => {
    disposed = true;
    unsubscribe();
  };
}
