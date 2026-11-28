/**
 * User administration list (#/users, admin only).
 * Columns: Usuario, Nombre (link to the detail), Rol, Estado and a last "Acciones" column
 * (Editar, Desactivar / Reactivar, Restablecer contraseña). Search, filters (rol, estado) and sorting
 * run on the loaded list (user-filter.js). "Nuevo usuario" opens the create dialog.
 */
import { h, icon, inventoryLoader, mount, pageHeader } from '../../core/dom.js';
import { handleError } from '../../core/notify.js';
import { ROLES } from '../../config/app-config.js';
import { select } from '../../shared/form.js';
import { avatar } from '../../shared/avatar.js';
import { formatNumber } from '../../shared/format.js';
import { listUsers } from './user.service.js';
import { EMPTY_USER_FILTERS, USER_SORT_OPTIONS, USER_STATUS, filterUsers, sortUsers } from './user-filter.js';
import { isSelf, openCreateUserDialog, statusBadge, userActionButtons } from './user-actions.js';
import { catalogsReady } from '../catalogs/catalog.store.js';

const COLUMNS = Object.freeze(['Usuario', 'Nombre', 'Rol', 'Estado', 'Acciones']);

/** Filters survive navigation within the session (e.g. list → detail → back). */
let filters = { ...EMPTY_USER_FILTERS };

const detailHref = (user) => `#/users/${encodeURIComponent(user.uid)}`;

function row(user, reload) {
  return h(
    'tr',
    null,
    h('td', { dataset: { label: 'Usuario' } }, user.username ? `@${user.username}` : '—'),
    h(
      'td',
      { dataset: { label: 'Nombre' } },
      h(
        'a',
        { href: detailHref(user), class: 'row-link person' },
        avatar(user, { size: 32 }),
        h('span', null, user.displayName, isSelf(user) ? h('small', { class: 'muted block' }, '(usted)') : null),
      ),
    ),
    h('td', { dataset: { label: 'Rol' } }, ROLES[user.role] ?? '—'),
    h('td', { dataset: { label: 'Estado' } }, statusBadge(user)),
    h('td', { class: 'col-actions', dataset: { label: 'Acciones' } }, userActionButtons(user, reload)),
  );
}

export async function render(container) {
  await catalogsReady();
  let users = [];
  let loaded = false;
  let disposed = false;

  const search = h('input', {
    type: 'search',
    class: 'search-input',
    placeholder: 'Buscar por nombre, usuario o correo…',
    'aria-label': 'Buscar usuarios',
    maxlength: 80,
    value: filters.text,
  });
  const selects = {
    role: select(ROLES, { value: filters.role, placeholder: 'Todos los roles', 'aria-label': 'Rol' }),
    status: select(USER_STATUS, { value: filters.status, placeholder: 'Activos e inactivos', 'aria-label': 'Estado' }),
    sort: select(USER_SORT_OPTIONS, { value: filters.sort, 'aria-label': 'Ordenar por' }),
  };
  const summary = h('p', { class: 'muted', role: 'status' });
  const results = h('section', { class: 'card' }, inventoryLoader({ label: 'Cargando usuarios…' }));

  function draw() {
    if (disposed || !loaded) return;
    const shown = sortUsers(filterUsers(users, filters), filters.sort);
    const active = users.filter((user) => user.active === true).length;
    summary.textContent = `Mostrando ${formatNumber(shown.length)} de ${formatNumber(users.length)} usuarios · ${formatNumber(active)} activos`;
    if (!shown.length) {
      mount(results, h('p', { class: 'empty-state' }, users.length ? 'Ningún usuario coincide con la búsqueda.' : 'Todavía no hay usuarios.'));
      return;
    }
    mount(
      results,
      h(
        'div',
        { class: 'table-scroll' },
        h(
          'table',
          { class: 'table responsive-table' },
          h('caption', { class: 'visually-hidden' }, 'Usuarios registrados'),
          h('thead', null, h('tr', null, COLUMNS.map((text) => h('th', { scope: 'col' }, text)))),
          h('tbody', null, shown.map((user) => row(user, reload))),
        ),
      ),
    );
  }

  async function reload() {
    try {
      const list = await listUsers();
      if (disposed) return;
      users = list;
      loaded = true;
      draw();
    } catch (error) {
      handleError(error, 'list users');
      if (!disposed && !loaded) mount(results, h('p', { class: 'empty-state' }, 'No se pudo cargar la lista de usuarios. Recargue la página.'));
    }
  }

  const update = (patch) => {
    filters = { ...filters, ...patch };
    draw();
  };
  let debounce = 0;
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => update({ text: search.value }), 200);
  });
  Object.entries(selects).forEach(([name, control]) => control.addEventListener('change', () => update({ [name]: control.value })));

  const add = h('button', { type: 'button', class: 'btn btn-primary' }, icon('plus'), 'Nuevo usuario');
  add.addEventListener('click', async () => {
    if (await openCreateUserDialog()) reload();
  });

  mount(
    container,
    pageHeader('Usuarios', add),
    h(
      'section',
      { class: 'card toolbar', 'aria-label': 'Búsqueda, filtros y orden' },
      h('div', { class: 'search-box' }, icon('search'), search),
      h('div', { class: 'filters' }, Object.values(selects)),
    ),
    summary,
    results,
  );
  await reload();
  return () => {
    disposed = true;
    clearTimeout(debounce);
  };
}
