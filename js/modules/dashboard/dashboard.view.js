/** Dashboard: key indicators and distribution by category, department, location, condition and availability. */
import { h, icon, mount, pageHeader } from '../../core/dom.js';
import { session } from '../../core/session.js';
import { assetStore } from '../assets/asset.store.js';
import { CATALOG_STORES, catalogLookups, catalogsReady } from '../catalogs/catalog.store.js';
import { formatCurrency, formatNumber } from '../../shared/format.js';
import { computeStats } from './dashboard.stats.js';

function kpi(label, value, tone = '') {
  return h('div', { class: `kpi${tone ? ` kpi--${tone}` : ''}` }, h('p', { class: 'kpi-label' }, label), h('p', { class: 'kpi-value' }, value));
}

/** Horizontal bar list (accessible: the numbers are text, bars are decorative). */
function barList(title, rows) {
  const max = Math.max(1, ...rows.map((r) => r.units));
  return h(
    'section',
    { class: 'card' },
    h('h2', null, title),
    rows.length === 0
      ? h('p', { class: 'muted' }, 'Sin datos todavía.')
      : h(
          'ul',
          { class: 'bars' },
          rows.map((row) =>
            h(
              'li',
              null,
              h('span', { class: 'bar-label' }, row.label),
              h('span', { class: 'bar-track', 'aria-hidden': 'true' }, h('span', { class: 'bar-fill', style: `width:${(row.units / max) * 100}%` })),
              h('span', { class: 'bar-value' }, formatNumber(row.units)),
            ),
          ),
        ),
  );
}

function draw(container) {
  const stats = computeStats(assetStore.getAll(), catalogLookups);
  const canWrite = session.can('assets.write');
  mount(
    container,
    pageHeader(
      `Hola, ${session.profile.displayName}`,
      canWrite ? h('a', { href: '#/inventory', class: 'btn btn-secondary' }, icon('check'), 'Toma de inventario') : null,
      canWrite ? h('a', { href: '#/assets/new', class: 'btn btn-primary' }, icon('plus'), 'Registrar artículo') : null,
    ),
    h(
      'section',
      { class: 'kpis', 'aria-label': 'Indicadores' },
      kpi('Artículos registrados', formatNumber(stats.totalRecords)),
      kpi('Unidades en total', formatNumber(stats.totalUnits)),
      kpi('Valor estimado', formatCurrency(stats.totalValue)),
      kpi('Necesitan atención', formatNumber(stats.needsAttention), stats.needsAttention ? 'warn' : ''),
    ),
    stats.totalRecords === 0
      ? h(
          'section',
          { class: 'card empty-state' },
          h('h2', null, 'Aún no hay artículos registrados'),
          h(
            'p',
            null,
            canWrite
              ? 'Primero cree las categorías, departamentos y ubicaciones; luego registre el primer artículo.'
              : 'Cuando se registren artículos, aquí verá el resumen.',
          ),
          canWrite ? h('a', { href: '#/catalogs', class: 'btn btn-secondary' }, 'Ir a catálogos') : null,
        )
      : h(
          'div',
          { class: 'grid-3' },
          barList('Por categoría (unidades)', stats.byType),
          barList('Por ubicación (unidades)', stats.byLocation),
          barList('Por departamento (unidades)', stats.byCategory),
          barList('Por estado (unidades)', stats.byCondition),
          barList('Por disponibilidad (unidades)', stats.byAvailability),
        ),
  );
}

export async function render(container) {
  await Promise.all([assetStore.whenReady(), catalogsReady()]);
  draw(container);
  const redraw = () => draw(container);
  const unsubscribers = [assetStore, ...CATALOG_STORES].map((store) => store.subscribe(redraw));
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
