/**
 * Dashboard (admin and editor only): key indicators, connected users, charts by condition,
 * availability, category, department and location, and shortcuts to the sections the role may use.
 *
 * Charts follow the eye-friendly rules: one soft color per bar list, segmented bars with a legend that
 * repeats every number and percent (identity is never color alone), and a tooltip on every mark.
 */
import { h, icon, mount, pageHeader } from '../../core/dom.js';
import { session } from '../../core/session.js';
import { NAV_ITEMS } from '../../config/navigation.js';
import { assetStore } from '../assets/asset.store.js';
import { CATALOG_STORES, catalogLookups, catalogsReady } from '../catalogs/catalog.store.js';
import { watchPresence } from '../presence/presence.service.js';
import { formatCurrency, formatNumber } from '../../shared/format.js';
import { computeStats, percentOf } from './dashboard.stats.js';

function kpi(label, value, { tone = '', iconName = '', detail = null } = {}) {
  return h(
    'div',
    { class: `kpi${tone ? ` kpi--${tone}` : ''}` },
    h('p', { class: 'kpi-label' }, iconName ? icon(iconName) : null, label),
    h('p', { class: 'kpi-value' }, value),
    detail,
  );
}

function shareText(units, total) {
  return `${formatNumber(units)} unidades · ${percentOf(units, total)} %`;
}

/** Horizontal bar list (accessible: the numbers are text, bars are decorative with a tooltip). */
function barList(title, rows) {
  const max = Math.max(1, ...rows.map((r) => r.units));
  const total = rows.reduce((sum, r) => sum + r.units, 0);
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
              { title: `${row.label}: ${shareText(row.units, total)}` },
              h('span', { class: 'bar-label' }, row.label),
              h('span', { class: 'bar-track', 'aria-hidden': 'true' }, h('span', { class: 'bar-fill', style: `width:${(row.units / max) * 100}%` })),
              h('span', { class: 'bar-value' }, formatNumber(row.units), h('small', { class: 'muted' }, ` ${percentOf(row.units, total)} %`)),
            ),
          ),
        ),
  );
}

/**
 * 100 % segmented bar for a fixed, ordered list (condition, availability). Empty values are left out;
 * the legend lists every shown value with its number and percent.
 */
function segmentedBar(title, rows, kind) {
  const shown = rows.filter((row) => row.units > 0);
  const total = shown.reduce((sum, row) => sum + row.units, 0);
  return h(
    'section',
    { class: 'card' },
    h('h2', null, title),
    total === 0
      ? h('p', { class: 'muted' }, 'Sin datos todavía.')
      : [
          h(
            'div',
            { class: 'stackbar', 'aria-hidden': 'true' },
            shown.map((row) =>
              h('span', {
                class: `stackbar-seg seg--${kind}-${row.key}`,
                style: `flex-grow:${row.units}`,
                title: `${row.label}: ${shareText(row.units, total)}`,
              }),
            ),
          ),
          h(
            'ul',
            { class: 'legend' },
            shown.map((row) =>
              h(
                'li',
                { title: `${row.label}: ${shareText(row.units, total)}` },
                h('span', { class: `legend-swatch seg--${kind}-${row.key}`, 'aria-hidden': 'true' }),
                h('span', { class: 'legend-label' }, row.label),
                h('span', { class: 'legend-value' }, formatNumber(row.units), h('small', { class: 'muted' }, ` ${percentOf(row.units, total)} %`)),
              ),
            ),
          ),
        ],
  );
}

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
  const items = NAV_ITEMS.filter((item) => item.path !== '/dashboard' && session.can(item.permission));
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
      `Hola, ${session.profile.displayName}`,
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
              ? 'Primero cree las categorías, departamentos y ubicaciones; luego registre el primer artículo.'
              : 'Cuando se registren artículos, aquí verá el resumen.',
          ),
          canWrite ? h('a', { href: '#/catalogs', class: 'btn btn-secondary' }, 'Ir a catálogos') : null,
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
            { class: 'grid-3' },
            barList('Por categoría', stats.byType),
            barList('Por departamento', stats.byCategory),
            barList('Por ubicación', stats.byLocation),
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
