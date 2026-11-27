/**
 * "Registros" list page for one kind (`#/records/:kind`): search, filters, sorting, how many
 * articles use each record, and add / edit (catalogs.write) / delete (catalogs.delete, admin only).
 */
import { h, icon, mount, pageHeader } from '../../core/dom.js';
import { session } from '../../core/session.js';
import { navigate } from '../../core/router.js';
import { formatNumber } from '../../shared/format.js';
import { select } from '../../shared/form.js';
import { assetStore } from '../assets/asset.store.js';
import { catalogsReady } from './catalog.store.js';
import { RECORDS_PATH, catalogKind } from './catalog-kinds.js';
import { EMPTY_FILTERS, LEADER_FILTERS, SORT_OPTIONS, USAGE_FILTERS, countUsage, filterCatalogItems, sortCatalogItems } from './catalog-filter.js';
import { openItemForm, removeItem, leaderSummary } from './catalog-form.js';

/** Filters per kind survive navigation within the session (e.g. list → hub → back). */
const filtersByKind = new Map();

function usageText(count) {
  if (!count) return 'Sin artículos';
  return count === 1 ? '1 artículo' : `${formatNumber(count)} artículos`;
}

function itemRow(kind, item, count, canDelete) {
  return h(
    'li',
    null,
    h(
      'div',
      { class: 'record-info' },
      h('strong', null, item.name),
      h('small', { class: `usage-chip${count ? '' : ' usage-chip--none'}` }, usageText(count)),
      kind.withLeader ? leaderSummary(item) : null,
      item.description ? h('small', { class: 'muted block' }, item.description) : null,
    ),
    h(
      'div',
      { class: 'button-row' },
      h('button', { type: 'button', class: 'btn btn-secondary btn-small', 'aria-label': `Editar ${item.name}`, onclick: () => openItemForm(kind, item) }, icon('edit'), 'Editar'),
      canDelete
        ? h('button', { type: 'button', class: 'btn btn-danger btn-small', 'aria-label': `Eliminar ${item.name}`, onclick: () => removeItem(kind, item) }, icon('trash'), 'Eliminar')
        : null,
    ),
  );
}

export async function render(container, { params }) {
  const kind = catalogKind(params.kind);
  if (!kind) {
    navigate(RECORDS_PATH);
    return undefined;
  }
  await Promise.all([assetStore.whenReady(), catalogsReady()]);
  const canDelete = session.can('catalogs.delete');
  let filters = filtersByKind.get(kind.slug) ?? { ...EMPTY_FILTERS };

  const search = h('input', {
    type: 'search',
    class: 'search-input',
    placeholder: kind.withLeader ? 'Buscar por nombre, descripción o líder…' : 'Buscar por nombre o descripción…',
    'aria-label': `Buscar ${kind.title.toLowerCase()}`,
    maxlength: 80,
    value: filters.text,
  });
  const usage = select(USAGE_FILTERS, { value: filters.usage, placeholder: 'Todos (con y sin artículos)', 'aria-label': 'Uso' });
  const leader = kind.withLeader ? select(LEADER_FILTERS, { value: filters.leader, placeholder: 'Con y sin líder', 'aria-label': 'Líder' }) : null;
  const sort = select(SORT_OPTIONS, { value: filters.sort, 'aria-label': 'Ordenar por' });
  const clear = h('button', { type: 'button', class: 'btn btn-link' }, 'Limpiar filtros');
  const summary = h('p', { class: 'muted', role: 'status' });
  const results = h('div', { class: 'results' });

  function drawResults() {
    const all = kind.store.getAll();
    const counts = countUsage(assetStore.getAll(), kind.service.usageField);
    const matches = sortCatalogItems(filterCatalogItems(all, filters, counts), filters.sort, counts);
    summary.textContent = `Mostrando ${matches.length} de ${all.length}`;
    if (!matches.length) {
      mount(results, h('p', { class: 'card empty-state' }, all.length ? 'Ningún registro coincide con la búsqueda.' : `Todavía no hay ${kind.title.toLowerCase()}. Use "Agregar" para crear el primero.`));
      return;
    }
    mount(
      results,
      h('section', { class: 'card' }, h('ul', { class: 'item-list record-list' }, matches.map((item) => itemRow(kind, item, counts.get(item.id) ?? 0, canDelete)))),
    );
  }

  function update(patch) {
    filters = { ...filters, ...patch };
    filtersByKind.set(kind.slug, filters);
    drawResults();
  }

  let debounce = 0;
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => update({ text: search.value }), 200);
  });
  usage.addEventListener('change', () => update({ usage: usage.value }));
  leader?.addEventListener('change', () => update({ leader: leader.value }));
  sort.addEventListener('change', () => update({ sort: sort.value }));
  clear.addEventListener('click', () => {
    search.value = '';
    usage.value = '';
    if (leader) leader.value = '';
    sort.value = EMPTY_FILTERS.sort;
    update({ ...EMPTY_FILTERS });
  });

  mount(
    container,
    h('a', { href: `#${RECORDS_PATH}`, class: 'btn btn-link back-link' }, icon('back'), 'Registros'),
    pageHeader(kind.title, h('button', { type: 'button', class: 'btn btn-primary', onclick: () => openItemForm(kind) }, icon('plus'), `Agregar ${kind.noun}`)),
    h('p', { class: 'muted' }, kind.intro),
    h(
      'section',
      { class: 'card toolbar', 'aria-label': 'Búsqueda y filtros' },
      h('div', { class: 'search-box' }, icon('search'), search),
      h('div', { class: 'filters' }, usage, leader, sort, clear),
    ),
    summary,
    results,
  );
  drawResults();

  const unsubscribers = [kind.store, assetStore].map((store) => store.subscribe(drawResults));
  return () => {
    clearTimeout(debounce);
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}
