/**
 * Dashboard "Tablero" (admin and editor only): key indicators, connected users, charts by condition,
 * availability, category, department and location, and shortcuts to the sections the role may use.
 *
 * Charts follow the eye-friendly rules: one soft color per bar list, segmented bars with a legend that
 * repeats every number and percent (identity is never color alone), and a tooltip on every mark.
 */
import { h, icon, mount, pageHeader } from '../../core/dom.js';
import { session } from '../../core/session.js';
import { NAV_ITEMS } from '../../config/navigation.js';
import { assetStore } from '../assets/asset.store.js';
import { CATALOG_STORES, categoryStore, catalogLookups, catalogsReady } from '../catalogs/catalog.store.js';
import { watchPresence } from '../presence/presence.service.js';
import { formatCurrency, formatNumber } from '../../shared/format.js';
import { barList, kpi, segmentedBar } from '../../shared/charts.js';
import { articlesPerDepartment, computeStats } from './dashboard.stats.js';

/** @param {Array<{ displayName: string }> | null | undefined} users undefined = still loading, null = cannot be read */
function connectedKpi(users) {
  if (users === undefined) return kpi('Usuarios conectados', '…', { iconName: 'online' });
  if (users === null) return kpi('Usuarios conectados', '—', { iconName: 'online', detail: h('small', { class: 'muted' }, 'No disponible') });
  const names = users.map((user) => user.displayName).join(', ');
  return kpi('Usuarios conectados', formatNumber(users.length), {
    iconName: 'online',
    detail: users.length ? h('small', { class: 'muted kpi-detail', title: names }, names) : h('small', { class: 'muted' }, 'Nadie más en este momento'),
  });
}

/** Shortcuts to the other sections this role may open (same list as the navigation). */
function shortcuts() {
  const items = NAV_ITEMS.filter((item) => !['/dashboard', '/home'].includes(item.path) && session.can(item.permission));
  return h(
    'section',
    { class: 'card', 'aria-labelledby': 'shortcuts-title' },
    h('h2', { id: 'shortcuts-title' }, 'Accesos directos'),
    h(
      'ul',
      { class: 'shortcuts' },
      items.map((item) =>
        h(
          'li',
          null,
          h('a', { href: `#${item.path}`, class: 'shortcut' }, icon(item.icon), h('span', null, h('strong', null, item.label), h('small', { class: 'muted block' }, item.hint))),
        ),
      ),
    ),
  );
}

function draw(container, connected) {
  const stats = computeStats(assetStore.getAll(), catalogLookups);
  const canWrite = session.can('assets.write');
  mount(
    container,
    pageHeader(
      'Tablero',
      canWrite ? h('a', { href: '#/inventory', class: 'btn btn-secondary' }, icon('check'), 'Toma de inventario') : null,
      canWrite ? h('a', { href: '#/assets/new', class: 'btn btn-primary' }, icon('plus'), 'Registrar artículo') : null,
    ),
    h(
      'section',
      { class: 'kpis', 'aria-label': 'Indicadores' },
      kpi('Artículos registrados', formatNumber(stats.totalRecords), { iconName: 'box' }),
      kpi('Unidades en total', formatNumber(stats.totalUnits)),
      kpi('Valor estimado', formatCurrency(stats.totalValue)),
      kpi('Necesitan atención', formatNumber(stats.needsAttention), {
        tone: stats.needsAttention ? 'warn' : '',
        iconName: 'alert',
        detail: h('small', { class: 'muted' }, 'Malo, fuera de servicio, en reparación o extraviado'),
      }),
      connectedKpi(connected),
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
              ? 'Primero cree los tipos de artículo, departamentos y ubicaciones; luego registre el primer artículo.'
              : 'Cuando se registren artículos, aquí verá el resumen.',
          ),
          canWrite ? h('a', { href: '#/records', class: 'btn btn-secondary' }, 'Ir a registros') : null,
        )
      : [
          h(
            'div',
            { class: 'grid-2' },
            segmentedBar('Estado de los artículos (unidades)', stats.byCondition, 'condition'),
            segmentedBar('Disponibilidad (unidades)', stats.byAvailability, 'availability'),
          ),
          barList('Artículos por departamento', articlesPerDepartment(assetStore.getAll(), categoryStore.getAll())),
          h(
            'div',
            { class: 'grid-2' },
            barList('Por tipo de artículo (unidades)', stats.byType),
            barList('Por ubicación (unidades)', stats.byLocation),
          ),
        ],
    shortcuts(),
  );
}

export async function render(container) {
  await Promise.all([assetStore.whenReady(), catalogsReady()]);
  let connected; // undefined until the first presence snapshot
  const redraw = () => draw(container, connected);
  redraw();
  const unsubscribers = [assetStore, ...CATALOG_STORES].map((store) => store.subscribe(redraw));
  unsubscribers.push(
    watchPresence((users) => {
      connected = users;
      redraw();
    }),
  );
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
