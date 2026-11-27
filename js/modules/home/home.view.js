/**
 * Home page "Inicio" (#/home, every role): overview indicators (articles, units, by category, by
 * location) and "Últimos movimientos", a vertical timeline of the last 10 articles added or updated,
 * in chronological order, with links to view them and, with permission, to edit them.
 * Everything comes from the in-memory stores: no extra reads.
 */
import { h, icon, mount, pageHeader } from '../../core/dom.js';
import { session } from '../../core/session.js';
import { assetStore } from '../assets/asset.store.js';
import { CATALOG_STORES, catalogLookups, catalogsReady } from '../catalogs/catalog.store.js';
import { computeStats } from '../dashboard/dashboard.stats.js';
import { barList, kpi } from '../../shared/charts.js';
import { formatDateTime, formatNumber } from '../../shared/format.js';
import { ACTIVITY, RECENT_COUNT, recentActivity } from './home.model.js';

function activityItem({ asset, at, activity }, isLatest, canWrite) {
  const href = `#/assets/${encodeURIComponent(asset.id)}`;
  return h(
    'li',
    { class: `timeline-item timeline-item--${activity}${isLatest ? ' timeline-item--latest' : ''}` },
    h(
      'p',
      { class: 'timeline-head' },
      h('time', { datetime: new Date(at).toISOString() }, formatDateTime(new Date(at))),
      h('span', { class: `badge badge--activity-${activity}` }, ACTIVITY[activity]),
      isLatest ? h('span', { class: 'badge badge--latest' }, 'Lo más reciente') : null,
    ),
    h('p', { class: 'timeline-asset' }, h('a', { href, class: 'row-link' }, asset.name)),
    h('p', { class: 'muted timeline-meta' }, `${catalogLookups.typeName(asset.typeId)} · ${catalogLookups.locationName(asset.locationId)}`),
    h(
      'div',
      { class: 'button-row timeline-actions' },
      h('a', { href, class: 'btn btn-secondary btn-small', 'aria-label': `Ver ${asset.name}` }, icon('eye'), 'Ver'),
      canWrite
        ? h('a', { href: `${href}/edit`, class: 'btn btn-secondary btn-small', 'aria-label': `Editar ${asset.name}` }, icon('edit'), 'Editar')
        : null,
    ),
  );
}

function recentSection(assets, canWrite) {
  const recent = recentActivity(assets, RECENT_COUNT);
  return h(
    'section',
    { class: 'card', 'aria-labelledby': 'recent-title' },
    h('h2', { id: 'recent-title' }, 'Últimos movimientos'),
    h('p', { class: 'hint' }, `Los ${RECENT_COUNT} artículos registrados o modificados más recientemente, en orden cronológico: lo más reciente queda al final.`),
    recent.length
      ? h('ol', { class: 'timeline' }, recent.map((item, index) => activityItem(item, index === recent.length - 1, canWrite)))
      : h('p', { class: 'muted' }, 'Todavía no hay artículos registrados.'),
  );
}

function draw(container) {
  const assets = assetStore.getAll();
  const stats = computeStats(assets, catalogLookups);
  const canWrite = session.can('assets.write');
  mount(
    container,
    pageHeader(
      `Hola, ${session.profile.displayName}`,
      h('a', { href: '#/assets', class: 'btn btn-secondary' }, icon('search'), 'Buscar artículos'),
      canWrite ? h('a', { href: '#/assets/new', class: 'btn btn-primary' }, icon('plus'), 'Registrar artículo') : null,
    ),
    h(
      'section',
      { class: 'kpis', 'aria-label': 'Resumen del inventario' },
      kpi('Artículos registrados', formatNumber(stats.totalRecords), { iconName: 'box' }),
      kpi('Unidades en total', formatNumber(stats.totalUnits)),
    ),
    h('div', { class: 'grid-2' }, barList('Artículos por categoría (unidades)', stats.byType), barList('Artículos por ubicación (unidades)', stats.byLocation)),
    recentSection(assets, canWrite),
  );
}

export async function render(container) {
  await Promise.all([assetStore.whenReady(), catalogsReady()]);
  draw(container);
  const redraw = () => draw(container);
  const unsubscribers = [assetStore, ...CATALOG_STORES].map((store) => store.subscribe(redraw));
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
