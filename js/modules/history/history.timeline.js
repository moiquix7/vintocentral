/**
 * History components (no route): the change timeline and the "Historial de cambios" section of the
 * article detail. Reused by other modules' views, like a service.
 *
 * Each entry reads as one short block: date and time · who · what, then one line per changed field
 * ("Estado: Bueno → Malo"). Text only, no color-only meaning.
 */
import { h } from '../../core/dom.js';
import { formatDateTime } from '../../shared/format.js';
import { FIELD_LABELS, HISTORY_ACTIONS } from './history.model.js';
import { listAssetHistory } from './history.service.js';

function isoOf(value) {
  const date = typeof value?.toDate === 'function' ? value.toDate() : value instanceof Date ? value : null;
  return date ? date.toISOString() : null;
}

function changeLine(change) {
  return h(
    'li',
    null,
    h('span', { class: 'change-field' }, `${FIELD_LABELS[change.field] ?? change.field}: `),
    h('span', { class: 'change-from' }, change.from || '(vacío)'),
    h('span', { class: 'change-arrow', 'aria-hidden': 'true' }, ' → '),
    h('span', { class: 'visually-hidden' }, ' cambió a '),
    h('span', { class: 'change-to' }, change.to || '(vacío)'),
  );
}

/**
 * @param {Array<object>} entries already sorted
 * @param {{ showAsset?: boolean, assetLink?: (entry: object) => string | null }} [options]
 *   showAsset: print the article name (history of all articles); assetLink: href when it still exists
 */
export function timeline(entries, { showAsset = false, assetLink = () => null } = {}) {
  return h(
    'ol',
    { class: 'timeline' },
    entries.map((entry) => {
      const href = showAsset ? assetLink(entry) : null;
      return h(
        'li',
        { class: `timeline-item timeline-item--${entry.action}` },
        h(
          'p',
          { class: 'timeline-head' },
          h('time', { datetime: isoOf(entry.at) }, formatDateTime(entry.at)),
          h('span', { class: 'timeline-who' }, entry.byName),
          h('span', { class: `badge badge--action-${entry.action}` }, HISTORY_ACTIONS[entry.action] ?? entry.action),
        ),
        showAsset
          ? h(
              'p',
              { class: 'timeline-asset' },
              href ? h('a', { href, class: 'row-link' }, entry.assetName) : [entry.assetName, h('small', { class: 'muted' }, ' (eliminado)')],
            )
          : null,
        entry.changes?.length ? h('ul', { class: 'changes' }, entry.changes.map(changeLine)) : null,
      );
    }),
  );
}

/**
 * "Historial de cambios" card of one article (oldest first). Call refresh() after the article changes.
 * Errors are shown inside the card; they never break the detail page.
 * @returns {{ node: HTMLElement, refresh: () => Promise<void> }}
 */
export function assetHistorySection(assetId) {
  const body = h('div', { 'aria-live': 'polite' }, h('p', { class: 'muted' }, 'Cargando historial…'));
  const node = h(
    'section',
    { class: 'card', 'aria-labelledby': 'asset-history-title' },
    h('h2', { id: 'asset-history-title' }, 'Historial de cambios'),
    h('p', { class: 'hint' }, 'Quién cambió qué y cuándo, del más antiguo al más reciente.'),
    body,
  );
  let request = 0;

  async function refresh() {
    const token = ++request;
    try {
      const entries = await listAssetHistory(assetId);
      if (token !== request) return;
      body.replaceChildren(entries.length ? timeline(entries) : h('p', { class: 'muted' }, 'Todavía no hay cambios registrados.'));
    } catch (error) {
      if (token !== request) return;
      console.warn('[VintoCentral] asset history', error);
      body.replaceChildren(h('p', { class: 'field-error' }, `No se pudo cargar el historial. ${error.userMessage ?? ''}`.trim()));
    }
  }

  refresh();
  return { node, refresh };
}
