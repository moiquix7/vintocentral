/**
 * "Historial" (#/history, admin and editor): latest changes of all articles, newest first, for
 * auditing. Text filter (article or user) and action filter run on the loaded entries;
 * "Cargar más" loads the next LIMITS.history.pageSize entries.
 */
import { h, icon, mount, pageHeader } from '../../core/dom.js';
import { handleError } from '../../core/notify.js';
import { LIMITS } from '../../config/app-config.js';
import { select } from '../../shared/form.js';
import { formatNumber } from '../../shared/format.js';
import { assetStore } from '../assets/asset.store.js';
import { HISTORY_ACTIONS, filterHistory, sortNewestFirst } from './history.model.js';
import { listRecentHistory } from './history.service.js';
import { timeline } from './history.timeline.js';

/** Filters survive navigation within the session (e.g. history → article → back). */
let filters = { text: '', action: '' };

export async function render(container) {
  await assetStore.whenReady();

  let count = LIMITS.history.pageSize;
  let entries = [];
  let hasMore = false;
  let loading = false;

  const search = h('input', {
    type: 'search',
    class: 'search-input',
    placeholder: 'Buscar por artículo o usuario…',
    'aria-label': 'Buscar en el historial',
    maxlength: 80,
    value: filters.text,
  });
  const action = select(HISTORY_ACTIONS, { value: filters.action, placeholder: 'Todas las acciones', 'aria-label': 'Acción' });
  const summary = h('p', { class: 'muted', role: 'status' });
  const results = h('div', { class: 'results' });
  const more = h('button', { type: 'button', class: 'btn btn-secondary btn-block' }, 'Cargar más');

  const assetLink = (entry) => (assetStore.getById(entry.assetId) ? `#/assets/${encodeURIComponent(entry.assetId)}` : null);

  function draw() {
    const shown = filterHistory(entries, filters);
    summary.textContent = `Mostrando ${formatNumber(shown.length)} de ${formatNumber(entries.length)} cambios cargados · los más recientes primero`;
    more.hidden = !hasMore;
    more.disabled = loading;
    if (!shown.length) {
      const message = loading ? 'Cargando historial…' : entries.length ? 'Ningún cambio coincide con la búsqueda.' : 'Todavía no hay cambios registrados.';
      mount(results, h('p', { class: 'card empty-state' }, message), more);
      return;
    }
    mount(results, h('section', { class: 'card' }, timeline(shown, { showAsset: true, assetLink })), more);
  }

  async function load() {
    loading = true;
    draw();
    try {
      const page = await listRecentHistory(count);
      entries = sortNewestFirst(page.entries);
      hasMore = page.hasMore;
    } catch (error) {
      handleError(error, 'history');
    } finally {
      loading = false;
      if (container.isConnected) draw();
    }
  }

  let debounce = 0;
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      filters = { ...filters, text: search.value };
      draw();
    }, 200);
  });
  action.addEventListener('change', () => {
    filters = { ...filters, action: action.value };
    draw();
  });
  more.addEventListener('click', () => {
    count += LIMITS.history.pageSize;
    load();
  });

  mount(
    container,
    pageHeader('Historial de cambios'),
    h('p', { class: 'muted' }, 'Registro de quién registró, modificó, verificó o eliminó cada artículo, y cuándo. No se puede editar ni borrar.'),
    h(
      'section',
      { class: 'card toolbar', 'aria-label': 'Búsqueda y filtros' },
      h('div', { class: 'search-box' }, icon('search'), search),
      h('div', { class: 'filters' }, action),
    ),
    summary,
    results,
  );
  await load();
  return () => clearTimeout(debounce);
}
