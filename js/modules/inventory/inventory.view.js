/**
 * Inventory-taking grid (#/inventory). Walk through the church, and for each article set its location,
 * condition and availability, then press "Verificar" (one write per row: asset.service.js → checkAsset).
 *
 * - Round start date: articles verified on or after it count as done (progress bar).
 * - Unsaved choices are kept in `drafts`, so live updates from other users never erase them.
 * - After a save, focus moves to the next row (keyboard-only work is possible).
 */
import { h, icon, mount, pageHeader } from '../../core/dom.js';
import { handleError } from '../../core/notify.js';
import { AVAILABILITY, CONDITIONS } from '../../config/app-config.js';
import { field, input, select } from '../../shared/form.js';
import { formatDateTime, formatNumber, todayIso } from '../../shared/format.js';
import { assetStore } from '../assets/asset.store.js';
import { checkAsset } from '../assets/asset.service.js';
import { EMPTY_FILTERS, filterAssets } from '../assets/asset-filter.js';
import {
  CATALOG_STORES,
  assetTypeStore,
  categoryStore,
  locationStore,
  catalogLookups,
  catalogOptions,
  catalogsReady,
} from '../catalogs/catalog.store.js';
import {
  CHECK_STATUS,
  DEFAULT_CHECK_STATUS,
  normalizeRoundStart,
  isChecked,
  filterByCheck,
  inventoryProgress,
  sortForWalk,
  storedStatus,
  hasChanges,
} from './inventory.model.js';

const PAGE_SIZE = 50;
const ROUND_KEY = 'vintocentral.inventoryRound';
const STATUS_FIELDS = Object.freeze(['locationId', 'condition', 'availability']);

/** Filters survive navigation within the session (e.g. grid → article detail → back). */
let filters = { ...EMPTY_FILTERS, check: DEFAULT_CHECK_STATUS };

function loadRoundStart() {
  try {
    return normalizeRoundStart(localStorage.getItem(ROUND_KEY), todayIso());
  } catch {
    return todayIso();
  }
}

function saveRoundStart(value) {
  try {
    localStorage.setItem(ROUND_KEY, value);
  } catch {
    /* storage unavailable: the date lasts until the page is reloaded */
  }
}

function valuesOf(controls) {
  return Object.fromEntries(STATUS_FIELDS.map((name) => [name, controls[name].value]));
}

function checkCell(asset, roundStart) {
  const done = isChecked(asset, roundStart);
  return h(
    'td',
    { dataset: { label: 'Verificación' } },
    h('span', { class: `badge ${done ? 'badge--checked' : 'badge--pending'}` }, done ? 'Verificado' : 'Pendiente'),
    asset.checkedAt ? h('small', { class: 'muted block secondary' }, formatDateTime(asset.checkedAt)) : null,
  );
}

export async function render(container) {
  await Promise.all([assetStore.whenReady(), catalogsReady()]);

  let roundStart = loadRoundStart();
  let visible = PAGE_SIZE;
  let shownIds = [];
  let focusTarget = null; // { asset, field } to focus after the next draw
  const drafts = new Map(); // asset id → { locationId, condition, availability } not saved yet

  const startDate = input({ type: 'date', max: todayIso(), value: roundStart });
  const progressBar = h('progress', { class: 'progress', max: '1', value: '0' });
  const progressText = h('p', { class: 'lead progress-text' });
  const lastSaved = h('p', { class: 'muted', role: 'status' });

  const search = h('input', {
    type: 'search',
    class: 'search-input',
    placeholder: 'Buscar por nombre, código, etiqueta…',
    'aria-label': 'Buscar artículos',
    maxlength: 80,
    value: filters.text,
  });
  const type = select(catalogOptions(assetTypeStore), { value: filters.typeId, placeholder: 'Todas las categorías', 'aria-label': 'Categoría' });
  const category = select(catalogOptions(categoryStore), { value: filters.categoryId, placeholder: 'Todos los departamentos', 'aria-label': 'Departamento' });
  const place = select(catalogOptions(locationStore), { value: filters.locationId, placeholder: 'Todas las ubicaciones', 'aria-label': 'Ubicación' });
  const check = select(CHECK_STATUS, { value: filters.check, 'aria-label': 'Verificación' });
  const summary = h('p', { class: 'muted', role: 'status' });
  const results = h('div', { class: 'results' });

  function nextIdAfter(id) {
    const index = shownIds.indexOf(id);
    return index >= 0 ? shownIds[index + 1] ?? null : null;
  }

  async function verify(asset, controls, button) {
    const values = valuesOf(controls);
    const nextId = nextIdAfter(asset.id);
    button.disabled = true;
    button.textContent = 'Guardando…';
    try {
      await checkAsset(asset.id, values);
      drafts.delete(asset.id);
      lastSaved.textContent = `Último verificado: ${asset.name}.`;
      focusTarget = nextId ? { asset: nextId, field: 'locationId' } : null;
      draw();
    } catch (error) {
      handleError(error, 'inventory check');
      if (button.isConnected) {
        button.disabled = false;
        controls.refresh();
      }
    }
  }

  function row(asset) {
    const draft = drafts.get(asset.id) ?? storedStatus(asset);
    const label = (text) => `${text} de ${asset.name}`;
    const controls = {
      locationId: select(catalogOptions(locationStore), {
        value: draft.locationId,
        placeholder: 'Elija…',
        'aria-label': label('Ubicación'),
        dataset: { asset: asset.id, field: 'locationId' },
      }),
      condition: select(CONDITIONS, { value: draft.condition, 'aria-label': label('Estado'), dataset: { asset: asset.id, field: 'condition' } }),
      availability: select(AVAILABILITY, {
        value: draft.availability,
        'aria-label': label('Disponibilidad'),
        dataset: { asset: asset.id, field: 'availability' },
      }),
    };
    const button = h('button', { type: 'button', class: 'btn btn-primary btn-small', dataset: { asset: asset.id, field: 'verify' } });
    const tr = h(
      'tr',
      null,
      h(
        'td',
        { dataset: { label: 'Artículo' } },
        h('a', { href: `#/assets/${encodeURIComponent(asset.id)}`, class: 'row-link' }, asset.name),
        asset.code ? h('small', { class: 'muted block' }, asset.code) : null,
        h('small', { class: 'muted block secondary' }, `${catalogLookups.typeName(asset.typeId)} · ${catalogLookups.categoryName(asset.categoryId)}`),
      ),
      h('td', { dataset: { label: 'Ubicación' } }, controls.locationId),
      h('td', { dataset: { label: 'Estado' } }, controls.condition),
      h('td', { dataset: { label: 'Disponibilidad' } }, controls.availability),
      checkCell(asset, roundStart),
      h('td', { class: 'col-action' }, button),
    );

    controls.refresh = () => {
      const current = valuesOf(controls);
      const changed = hasChanges(asset, current);
      if (changed) drafts.set(asset.id, current);
      else drafts.delete(asset.id);
      tr.classList.toggle('is-changed', changed);
      button.replaceChildren(icon('check'), changed ? 'Guardar y verificar' : 'Verificar');
      button.setAttribute('aria-label', `${changed ? 'Guardar y verificar' : 'Verificar'}: ${asset.name}`);
    };
    STATUS_FIELDS.forEach((name) => controls[name].addEventListener('change', controls.refresh));
    button.addEventListener('click', () => verify(asset, controls, button));
    controls.refresh();
    return tr;
  }

  /** Control to focus after redrawing: the requested one, or the one that had focus before. */
  function focusToRestore() {
    if (focusTarget) return focusTarget;
    const active = document.activeElement;
    return results.contains(active) && active.dataset.asset ? { asset: active.dataset.asset, field: active.dataset.field } : null;
  }

  function draw() {
    const keep = focusToRestore();
    focusTarget = null;

    const all = assetStore.getAll();
    const scope = filterAssets(all, filters, catalogLookups);
    const progress = inventoryProgress(scope, roundStart);
    progressBar.max = String(Math.max(progress.total, 1));
    progressBar.value = String(progress.checked);
    progressBar.setAttribute('aria-label', 'Avance de la toma de inventario');
    progressText.textContent = `Verificados: ${formatNumber(progress.checked)} de ${formatNumber(progress.total)} (${progress.percent} %)`;

    const matches = sortForWalk(filterByCheck(scope, filters.check, roundStart), catalogLookups.locationName);
    const page = matches.slice(0, visible);
    shownIds = page.map((asset) => asset.id);
    summary.textContent = `Mostrando ${page.length} de ${matches.length}`;

    if (matches.length === 0) {
      const message = !all.length
        ? 'Aún no hay artículos registrados.'
        : filters.check === 'pending' && progress.total
          ? '¡Listo! No quedan artículos pendientes con estos filtros.'
          : 'Ningún artículo coincide con los filtros.';
      mount(results, h('p', { class: 'card empty-state' }, message));
      return;
    }

    const more =
      matches.length > visible
        ? h('button', { type: 'button', class: 'btn btn-secondary btn-block', onclick: () => { visible += PAGE_SIZE; draw(); } }, 'Mostrar más')
        : null;
    mount(
      results,
      h(
        'div',
        { class: 'table-scroll' },
        h(
          'table',
          { class: 'table responsive-table inventory-table' },
          h('caption', { class: 'visually-hidden' }, 'Toma de inventario: un artículo por fila'),
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              ['Artículo', 'Ubicación', 'Estado', 'Disponibilidad', 'Verificación'].map((text) => h('th', { scope: 'col' }, text)),
              h('th', { scope: 'col' }, h('span', { class: 'visually-hidden' }, 'Acción')),
            ),
          ),
          h('tbody', null, page.map(row)),
        ),
      ),
      more,
    );

    if (keep) results.querySelector(`[data-asset="${CSS.escape(keep.asset)}"][data-field="${CSS.escape(keep.field)}"]`)?.focus();
  }

  function update(patch) {
    filters = { ...filters, ...patch };
    visible = PAGE_SIZE;
    draw();
  }

  startDate.addEventListener('change', () => {
    roundStart = normalizeRoundStart(startDate.value, todayIso());
    startDate.value = roundStart;
    saveRoundStart(roundStart);
    draw();
  });
  let debounce = 0;
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => update({ text: search.value }), 200);
  });
  type.addEventListener('change', () => update({ typeId: type.value }));
  category.addEventListener('change', () => update({ categoryId: category.value }));
  place.addEventListener('change', () => update({ locationId: place.value }));
  check.addEventListener('change', () => update({ check: check.value }));

  mount(
    container,
    pageHeader('Toma de inventario'),
    h(
      'section',
      { class: 'card inventory-round', 'aria-label': 'Avance' },
      h(
        'p',
        { class: 'muted' },
        'Recorra la iglesia por ubicación. En cada artículo revise la ubicación, el estado y la disponibilidad, y pulse ',
        h('strong', null, 'Verificar'),
        '.',
      ),
      h(
        'div',
        { class: 'inventory-round-grid' },
        field({ label: 'Inventario iniciado el', name: 'roundStart', control: startDate, hint: 'Cuenta como verificado lo revisado desde esta fecha.' }),
        h('div', { class: 'stack-tight' }, progressText, progressBar, lastSaved),
      ),
    ),
    h(
      'section',
      { class: 'card toolbar', 'aria-label': 'Búsqueda y filtros' },
      h('div', { class: 'search-box' }, icon('search'), search),
      h('div', { class: 'filters' }, check, place, type, category),
    ),
    summary,
    results,
  );
  draw();

  const unsubscribers = [assetStore, ...CATALOG_STORES].map((store) => store.subscribe(draw));
  return () => {
    clearTimeout(debounce);
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}
