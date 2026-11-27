/**
 * Inventory-taking grid (#/inventory). Walk through the church and, for each article, review its
 * location, condition and availability. Changes are saved automatically (asset.service.js → checkAsset):
 * dropdowns at once, the text fields (reason, notes) when they lose focus. Every save also marks the
 * article as verified; the "Verificado" checkbox does it for an article that needs no change.
 *
 * - Round start date: articles verified on or after it count as done (progress bar).
 * - Saves of one row are queued; unsaved values live in `drafts`, so live updates from other users
 *   never erase them, and a failed save keeps them (the row offers "Reintentar").
 * - Rows saved since the filters last changed stay listed (`keep`), so a row does not vanish from
 *   "Pendientes" after its first change.
 */
import { h, icon, inventoryLoader, mount, pageHeader } from '../../core/dom.js';
import { handleError } from '../../core/notify.js';
import { AVAILABILITY, CONDITIONS, LIMITS } from '../../config/app-config.js';
import { field, input, select } from '../../shared/form.js';
import { formatDateTime, formatNumber, todayIso } from '../../shared/format.js';
import { assetStore } from '../assets/asset.store.js';
import { checkAsset } from '../assets/asset.service.js';
import { INVENTORY_FIELDS, isUnavailable } from '../assets/asset.model.js';
import { EMPTY_FILTERS, SORT_OPTIONS, filterAssets, sortAssets } from '../assets/asset-filter.js';
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
  DEFAULT_INVENTORY_SORT,
  normalizeRoundStart,
  isChecked,
  filterByCheck,
  inventoryProgress,
  storedStatus,
  sameStatus,
} from './inventory.model.js';

const PAGE_SIZE = 50;
const ROUND_KEY = 'vintocentral.inventoryRound';
const COLUMNS = Object.freeze(['Artículo', 'Tipo de artículo', 'Departamento', 'Ubicación', 'Estado', 'Disponibilidad', 'Motivo / Observaciones', 'Verificado']);

/** Filters survive navigation within the session (e.g. grid → article detail → back). */
let filters = { ...EMPTY_FILTERS, check: DEFAULT_CHECK_STATUS, sort: DEFAULT_INVENTORY_SORT };

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
  const values = Object.fromEntries(INVENTORY_FIELDS.map((name) => [name, controls[name].value]));
  if (!isUnavailable(values.availability)) values.unavailableReason = '';
  return values;
}

export async function render(container) {
  await Promise.all([assetStore.whenReady(), catalogsReady()]);

  let roundStart = loadRoundStart();
  let visible = PAGE_SIZE;
  let shownIds = [];
  let focusTarget = null; // { asset, field } to focus after the next draw
  let disposed = false;
  const drafts = new Map(); // asset id → values not confirmed by the server yet
  const queues = new Map(); // asset id → { running, next, moveNext }
  const rowState = new Map(); // asset id → 'saving' | 'error'
  const keep = new Set(); // ids saved since the filters last changed

  const startDate = input({ type: 'date', max: todayIso(), value: roundStart });
  const progressBar = h('progress', { class: 'progress', max: '1', value: '0', 'aria-label': 'Avance de la toma de inventario' });
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
  const selects = {
    check: select(CHECK_STATUS, { value: filters.check, 'aria-label': 'Verificación' }),
    locationId: select(catalogOptions(locationStore), { value: filters.locationId, placeholder: 'Todas las ubicaciones', 'aria-label': 'Ubicación' }),
    typeId: select(catalogOptions(assetTypeStore), { value: filters.typeId, placeholder: 'Todos los tipos', 'aria-label': 'Tipo de artículo' }),
    categoryId: select(catalogOptions(categoryStore), { value: filters.categoryId, placeholder: 'Todos los departamentos', 'aria-label': 'Departamento' }),
    condition: select(CONDITIONS, { value: filters.condition, placeholder: 'Todos los estados', 'aria-label': 'Estado' }),
    availability: select(AVAILABILITY, { value: filters.availability, placeholder: 'Toda disponibilidad', 'aria-label': 'Disponibilidad' }),
    sort: select(SORT_OPTIONS, { value: filters.sort, 'aria-label': 'Ordenar por' }),
  };
  const summary = h('p', { class: 'muted', role: 'status' });
  const results = h('div', { class: 'results' });

  function nextIdAfter(id) {
    const index = shownIds.indexOf(id);
    return index >= 0 ? shownIds[index + 1] ?? null : null;
  }

  /** Queues a save of `values` for this row; only the latest pending values are written. */
  function save(asset, values, { moveNext = false } = {}) {
    drafts.set(asset.id, values);
    keep.add(asset.id);
    const queue = queues.get(asset.id) ?? { running: false, next: null, moveNext: false };
    queues.set(asset.id, queue);
    queue.next = values;
    queue.moveNext ||= moveNext;
    if (!queue.running) runQueue(asset, queue);
  }

  async function runQueue(asset, queue) {
    queue.running = true;
    rowState.set(asset.id, 'saving');
    draw();
    let failed = false;
    // Keeps writing even after leaving the page: the last change must not be lost.
    while (queue.next) {
      const values = queue.next;
      queue.next = null;
      try {
        await checkAsset(asset.id, values);
        if (drafts.get(asset.id) === values) drafts.delete(asset.id);
      } catch (error) {
        handleError(error, 'inventory save');
        queue.next = null;
        failed = true;
      }
    }
    queue.running = false;
    if (disposed) return;
    if (failed) {
      rowState.set(asset.id, 'error');
      lastSaved.textContent = `No se guardó: ${asset.name}. Pulse «Reintentar».`;
      if (queue.moveNext) focusTarget = { asset: asset.id, field: 'retry' };
    } else {
      rowState.delete(asset.id);
      lastSaved.textContent = `Guardado y verificado: ${asset.name}.`;
      if (queue.moveNext) {
        const nextId = nextIdAfter(asset.id);
        focusTarget = nextId ? { asset: nextId, field: 'locationId' } : null;
      }
    }
    queue.moveNext = false;
    draw();
  }

  function statusCell(asset, controls) {
    const state = rowState.get(asset.id);
    const done = isChecked(asset, roundStart);
    const checkbox = h('input', {
      type: 'checkbox',
      checked: done || state === 'saving',
      disabled: done || state === 'saving',
      'aria-label': `Verificado: ${asset.name}`,
      dataset: { asset: asset.id, field: 'verify' },
    });
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) save(asset, valuesOf(controls), { moveNext: true });
    });

    let detail = null;
    if (state === 'saving') detail = h('small', { class: 'muted block' }, inventoryLoader({ label: 'Guardando…', size: 'small' }));
    else if (state === 'error') {
      detail = h(
        'button',
        {
          type: 'button',
          class: 'btn btn-secondary btn-small',
          dataset: { asset: asset.id, field: 'retry' },
          onclick: () => save(asset, drafts.get(asset.id) ?? valuesOf(controls)),
        },
        'Reintentar',
      );
    } else if (asset.checkedAt) detail = h('small', { class: 'muted block' }, formatDateTime(asset.checkedAt));

    return h(
      'td',
      { dataset: { label: 'Verificado' }, class: 'col-check' },
      h('label', { class: 'check-toggle' }, checkbox, h('span', null, done ? 'Verificado' : 'Pendiente')),
      detail,
    );
  }

  function row(asset) {
    const current = drafts.get(asset.id) ?? storedStatus(asset);
    const label = (text) => `${text} de ${asset.name}`;
    const data = (name) => ({ asset: asset.id, field: name });
    const controls = {
      locationId: select(catalogOptions(locationStore), { value: current.locationId, placeholder: 'Elija…', 'aria-label': label('Ubicación'), dataset: data('locationId') }),
      condition: select(CONDITIONS, { value: current.condition, 'aria-label': label('Estado'), dataset: data('condition') }),
      availability: select(AVAILABILITY, { value: current.availability, 'aria-label': label('Disponibilidad'), dataset: data('availability') }),
      unavailableReason: input({
        value: current.unavailableReason,
        maxlength: LIMITS.asset.unavailableReason,
        placeholder: 'Motivo: ¿por qué no está disponible?',
        'aria-label': label('Motivo de no disponibilidad'),
        hidden: !isUnavailable(current.availability),
        dataset: data('unavailableReason'),
      }),
      notes: input({
        value: current.notes,
        maxlength: LIMITS.asset.notes,
        placeholder: 'Observaciones',
        'aria-label': label('Observaciones'),
        dataset: data('notes'),
      }),
    };

    const saveIfChanged = () => {
      const values = valuesOf(controls);
      if (!sameStatus(values, drafts.get(asset.id) ?? storedStatus(asset))) save(asset, values);
    };
    ['locationId', 'condition', 'availability'].forEach((name) => controls[name].addEventListener('change', saveIfChanged));
    controls.availability.addEventListener('change', () => {
      controls.unavailableReason.hidden = !isUnavailable(controls.availability.value);
    });
    // Text fields: 'change' fires on blur or Enter, so a save never interrupts typing.
    ['unavailableReason', 'notes'].forEach((name) => controls[name].addEventListener('change', saveIfChanged));

    const state = rowState.get(asset.id);
    return h(
      'tr',
      { class: state === 'error' ? 'is-error' : state === 'saving' ? 'is-saving' : null },
      h(
        'td',
        { dataset: { label: 'Artículo' } },
        h('a', { href: `#/assets/${encodeURIComponent(asset.id)}`, class: 'row-link' }, asset.name),
        asset.code ? h('small', { class: 'muted block' }, asset.code) : null,
      ),
      h('td', { dataset: { label: 'Tipo de artículo' } }, catalogLookups.typeName(asset.typeId)),
      h('td', { dataset: { label: 'Departamento' } }, catalogLookups.categoryName(asset.categoryId)),
      h('td', { dataset: { label: 'Ubicación' } }, controls.locationId),
      h('td', { dataset: { label: 'Estado' } }, controls.condition),
      h('td', { dataset: { label: 'Disponibilidad' } }, controls.availability),
      h('td', { dataset: { label: 'Motivo / Observaciones' }, class: 'col-notes' }, controls.unavailableReason, controls.notes),
      statusCell(asset, controls),
    );
  }

  /** Control to focus after redrawing: the requested one, or the one that had focus before. */
  function focusToRestore() {
    if (focusTarget) return focusTarget;
    const active = document.activeElement;
    return results.contains(active) && active.dataset.asset ? { asset: active.dataset.asset, field: active.dataset.field } : null;
  }

  function draw() {
    if (disposed) return;
    const keepFocus = focusToRestore();
    focusTarget = null;

    const all = assetStore.getAll();
    const scope = filterAssets(all, filters, catalogLookups);
    const progress = inventoryProgress(scope, roundStart);
    progressBar.max = String(Math.max(progress.total, 1));
    progressBar.value = String(progress.checked);
    progressText.textContent = `Verificados: ${formatNumber(progress.checked)} de ${formatNumber(progress.total)} (${progress.percent} %)`;

    const matches = sortAssets(filterByCheck(scope, filters.check, roundStart, keep), filters.sort, catalogLookups);
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
          h('caption', { class: 'visually-hidden' }, 'Toma de inventario: un artículo por fila; los cambios se guardan solos'),
          h('thead', null, h('tr', null, COLUMNS.map((text) => h('th', { scope: 'col' }, text)))),
          h('tbody', null, page.map(row)),
        ),
      ),
      more,
    );

    if (keepFocus) results.querySelector(`[data-asset="${CSS.escape(keepFocus.asset)}"][data-field="${CSS.escape(keepFocus.field)}"]`)?.focus();
  }

  function update(patch) {
    filters = { ...filters, ...patch };
    visible = PAGE_SIZE;
    keep.clear();
    draw();
  }

  startDate.addEventListener('change', () => {
    roundStart = normalizeRoundStart(startDate.value, todayIso());
    startDate.value = roundStart;
    saveRoundStart(roundStart);
    keep.clear();
    draw();
  });
  let debounce = 0;
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => update({ text: search.value }), 200);
  });
  Object.entries(selects).forEach(([name, control]) => control.addEventListener('change', () => update({ [name]: control.value })));

  mount(
    container,
    pageHeader('Toma de inventario'),
    h(
      'section',
      { class: 'card inventory-round', 'aria-label': 'Avance' },
      h(
        'p',
        { class: 'muted' },
        'Recorra la iglesia por ubicación. Revise cada artículo: ',
        h('strong', null, 'los cambios se guardan solos'),
        '. Si el artículo está bien y no necesita cambios, marque ',
        h('strong', null, 'Verificado'),
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
      { class: 'card toolbar', 'aria-label': 'Búsqueda, filtros y orden' },
      h('div', { class: 'search-box' }, icon('search'), search),
      h('div', { class: 'filters' }, Object.values(selects)),
    ),
    summary,
    results,
  );
  draw();

  const unsubscribers = [assetStore, ...CATALOG_STORES].map((store) => store.subscribe(draw));
  return () => {
    disposed = true;
    clearTimeout(debounce);
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}
