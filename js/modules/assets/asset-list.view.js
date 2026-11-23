/** Asset list with search, filters, sorting and incremental paging. */
import { h, icon, mount, pageHeader } from '../../core/dom.js';
import { session } from '../../core/session.js';
import { CONDITIONS } from '../../config/app-config.js';
import { formatCurrency, formatNumber } from '../../shared/format.js';
import { select } from '../../shared/form.js';
import { assetStore } from './asset.store.js';
import { categoryStore, locationStore, catalogLookups } from '../catalogs/catalog.store.js';
import { EMPTY_FILTERS, SORT_OPTIONS, filterAssets, sortAssets } from './asset-filter.js';
import { conditionBadge, thumbnail } from './asset-ui.js';

const PAGE_SIZE = 50;

/** Filters survive navigation within the session (e.g. list → detail → back). */
let filters = { ...EMPTY_FILTERS };

function catalogOptions(store) {
  return Object.fromEntries(store.getAll().map((item) => [item.id, item.name]));
}

function row(asset) {
  return h(
    'tr',
    null,
    h('td', { class: 'col-thumb secondary' }, thumbnail(asset)),
    h(
      'td',
      { dataset: { label: 'Nombre' } },
      h('a', { href: `#/assets/${encodeURIComponent(asset.id)}`, class: 'row-link' }, asset.name),
      asset.code ? h('small', { class: 'muted block' }, asset.code) : null,
    ),
    h('td', { dataset: { label: 'Departamento' } }, catalogLookups.categoryName(asset.categoryId)),
    h('td', { dataset: { label: 'Ubicación' } }, catalogLookups.locationName(asset.locationId)),
    h('td', { dataset: { label: 'Estado' } }, conditionBadge(asset.condition)),
    h('td', { class: 'num', dataset: { label: 'Cantidad' } }, formatNumber(asset.quantity)),
    h('td', { class: 'num secondary', dataset: { label: 'Valor unitario' } }, formatCurrency(asset.value)),
  );
}

export async function render(container) {
  await Promise.all([assetStore.whenReady(), categoryStore.whenReady(), locationStore.whenReady()]);
  let visible = PAGE_SIZE;

  const search = h('input', {
    type: 'search',
    class: 'search-input',
    placeholder: 'Buscar por nombre, código, etiqueta…',
    'aria-label': 'Buscar bienes',
    maxlength: 80,
    value: filters.text,
  });
  const category = select(catalogOptions(categoryStore), { value: filters.categoryId, placeholder: 'Todos los departamentos', 'aria-label': 'Departamento' });
  const locationSelect = select(catalogOptions(locationStore), { value: filters.locationId, placeholder: 'Todas las ubicaciones', 'aria-label': 'Ubicación' });
  const condition = select(CONDITIONS, { value: filters.condition, placeholder: 'Todos los estados', 'aria-label': 'Estado' });
  const sort = select(SORT_OPTIONS, { value: filters.sort, 'aria-label': 'Ordenar por' });
  const clear = h('button', { type: 'button', class: 'btn btn-link' }, 'Limpiar filtros');
  const summary = h('p', { class: 'muted', role: 'status' });
  const results = h('div', { class: 'results' });

  function drawResults() {
    const matches = sortAssets(filterAssets(assetStore.getAll(), filters, catalogLookups), filters.sort);
    const total = assetStore.getAll().length;
    summary.textContent = `Mostrando ${Math.min(visible, matches.length)} de ${matches.length} (total registrados: ${total})`;
    if (matches.length === 0) {
      mount(results, h('p', { class: 'card empty-state' }, total ? 'Ningún bien coincide con la búsqueda.' : 'Aún no hay bienes registrados.'));
      return;
    }
    const more =
      matches.length > visible
        ? h('button', { type: 'button', class: 'btn btn-secondary btn-block', onclick: () => { visible += PAGE_SIZE; drawResults(); } }, 'Mostrar más')
        : null;
    mount(
      results,
      h(
        'table',
        { class: 'table responsive-table' },
        h('caption', { class: 'visually-hidden' }, 'Lista de bienes'),
        h(
          'thead',
          null,
          h(
            'tr',
            null,
            h('th', { scope: 'col', class: 'col-thumb secondary' }, h('span', { class: 'visually-hidden' }, 'Foto')),
            ['Nombre', 'Departamento', 'Ubicación', 'Estado'].map((label) => h('th', { scope: 'col' }, label)),
            h('th', { scope: 'col', class: 'num' }, 'Cant.'),
            h('th', { scope: 'col', class: 'num secondary' }, 'Valor unit.'),
          ),
        ),
        h('tbody', null, matches.slice(0, visible).map(row)),
      ),
      more,
    );
  }

  function update(patch) {
    filters = { ...filters, ...patch };
    visible = PAGE_SIZE;
    drawResults();
  }

  let debounce = 0;
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => update({ text: search.value }), 200);
  });
  category.addEventListener('change', () => update({ categoryId: category.value }));
  locationSelect.addEventListener('change', () => update({ locationId: locationSelect.value }));
  condition.addEventListener('change', () => update({ condition: condition.value }));
  sort.addEventListener('change', () => update({ sort: sort.value }));
  clear.addEventListener('click', () => {
    search.value = '';
    category.value = '';
    locationSelect.value = '';
    condition.value = '';
    sort.value = EMPTY_FILTERS.sort;
    update({ ...EMPTY_FILTERS });
  });

  mount(
    container,
    pageHeader(
      'Bienes',
      session.can('assets.write') ? h('a', { href: '#/assets/new', class: 'btn btn-primary' }, icon('plus'), 'Registrar bien') : null,
    ),
    h(
      'section',
      { class: 'card toolbar', 'aria-label': 'Búsqueda y filtros' },
      h('div', { class: 'search-box' }, icon('search'), search),
      h('div', { class: 'filters' }, category, locationSelect, condition, sort, clear),
    ),
    summary,
    results,
  );
  drawResults();

  const unsubscribers = [assetStore, categoryStore, locationStore].map((store) => store.subscribe(drawResults));
  return () => {
    clearTimeout(debounce);
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}
