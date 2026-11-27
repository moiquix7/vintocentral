/**
 * Eye-friendly chart building blocks (no domain knowledge): KPI tile, horizontal bar list and
 * 100 % segmented bar with legend. Numbers are always text; bars are decorative and carry a tooltip,
 * so nothing depends on color alone. Styles: css/components.css (.kpi, .bars, .stackbar, .legend).
 */
import { h, icon } from '../core/dom.js';
import { formatNumber, percentOf } from './format.js';

/**
 * @param {string} label
 * @param {string} value already formatted
 * @param {{ tone?: string, iconName?: string, detail?: Node | null }} [options]
 */
export function kpi(label, value, { tone = '', iconName = '', detail = null } = {}) {
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

/**
 * Card with a horizontal bar per row (largest first is the caller's choice).
 * @param {string} title
 * @param {Array<{ label: string, units: number }>} rows
 */
export function barList(title, rows) {
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
 * Card with a 100 % segmented bar for a fixed, ordered list. Empty values are left out; the legend
 * lists every shown value with its number and percent. Segment color: class `seg--{kind}-{key}`.
 * @param {string} title
 * @param {Array<{ key: string, label: string, units: number }>} rows
 * @param {string} kind e.g. 'condition', 'availability'
 */
export function segmentedBar(title, rows, kind) {
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
