/**
 * Dashboard "Tablero" (admin and editor only): key indicators, connected users, charts by condition,
 * availability, category, department and location, and shortcuts to the sections the role may use.
 *
 * Charts follow the eye-friendly rules: one soft color per bar list, segmented bars with a legend that
 * repeats every number and percent (identity is never color alone), and a tooltip on every mark.
 */
import { h, icon, inventoryLoader, mount, pageHeader } from '../../core/dom.js';
import { session } from '../../core/session.js';
import { NAV_ITEMS } from '../../config/navigation.js';
import { assetStore } from '../assets/asset.store.js';
import { CATALOG_STORES, categoryStore, locationStore, catalogLookups, catalogsReady } from '../catalogs/catalog.store.js';
import { watchPresence } from '../presence/presence.service.js';
import { formatCurrency, formatNumber, percentOf } from '../../shared/format.js';
import { axisBarChart, barList, kpi, segmentedBar } from '../../shared/charts.js';
import { articlesPerRecord, computeStats } from './dashboard.stats.js';

/** @param {Array<{ displayName: string }> | null | undefined} users undefined = still loading, null = cannot be read */
function connectedKpi(users) {
  if (users === undefined) return kpi('Usuarios conectados', inventoryLoader({ label: 'Cargando…', size: 'small' }), { iconName: 'online' });
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

/**
 * "Necesitan atención" tile: red when there is at least one, linked to the filtered article list.
 * Pill: share of the articles (real data, not a trend).
 * @param {number} count
 * @param {number} totalRecords
 * @param {boolean} pulse play the soft red pulse (only on open or when the number changed)
 */
function attentionKpi(count, totalRecords, pulse) {
  return kpi('Necesitan atención', formatNumber(count), {
    tone: count ? 'alert' : '',
    pulse: count > 0 && pulse,
    iconName: 'alert',
    badge: count ? { text: `${percentOf(count, totalRecords)} % del total`, tone: 'bad' } : { text: 'Todo en orden', tone: 'good' },
    detail: h('small', { class: 'muted block' }, 'Malo, fuera de servicio, en reparación o extraviado'),
    href: '#/assets?filtro=atencion',
    linkText: count ? 'Ver la lista' : 'Ver artículos',
  });
}

/**
 * Pill for "Unidades en total": share of units whose availability is "Disponible" (same figure as the
 * Disponibilidad chart). None while there are no units.
 * @param {{ totalUnits: number, byAvailability: Array<{ key: string, units: number }> }} stats
 */
function availableBadge({ totalUnits, byAvailability }) {
  if (!totalUnits) return null;
  const available = byAvailability.find((row) => row.key === 'available')?.units ?? 0;
  return { text: `${percentOf(available, totalUnits)} % disponible`, tone: 'neutral' };
}

/**
 * @param {HTMLElement} container
 * @param {Array<{ displayName: string }> | null | undefined} connected
 * @param {{ attentionShown: number | null }} state remembers the last attention count drawn, so a
 *   redraw (e.g. a presence heartbeat) does not replay the pulse
 */
function draw(container, connected, state) {
  const stats = computeStats(assetStore.getAll(), catalogLookups);
  const pulse = stats.needsAttention !== state.attentionShown;
  state.attentionShown = stats.needsAttention;
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
      kpi('Unidades en total', formatNumber(stats.totalUnits), { iconName: 'layers', badge: availableBadge(stats) }),
      kpi('Valor estimado', formatCurrency(stats.totalValue), { iconName: 'dollar' }),
      attentionKpi(stats.needsAttention, stats.totalRecords, pulse),
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
          h(
            'div',
            { class: 'grid-2' },
            axisBarChart('Artículos por departamento', articlesPerRecord(assetStore.getAll(), categoryStore.getAll(), 'categoryId', 'Sin departamento'), {
              axisLabel: 'Número de artículos',
              item: ['departamento', 'departamentos'],
            }),
            axisBarChart('Artículos por ubicación', articlesPerRecord(assetStore.getAll(), locationStore.getAll(), 'locationId', 'Sin ubicación'), {
              axisLabel: 'Número de artículos',
              item: ['ubicación', 'ubicaciones'],
            }),
          ),
          barList('Por tipo de artículo (unidades)', stats.byType, { item: ['tipo', 'tipos'] }),
        ],
    shortcuts(),
  );
}

export async function render(container) {
  await Promise.all([assetStore.whenReady(), catalogsReady()]);
  let connected; // undefined until the first presence snapshot
  const state = { attentionShown: null };
  const redraw = () => draw(container, connected, state);
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
