/**
 * Eye-friendly chart building blocks (no domain knowledge): KPI tile, horizontal bar list and
 * 100 % segmented bar with legend. Numbers are always text; bars are decorative and carry a tooltip,
 * so nothing depends on color alone. Styles: css/components.css (.kpi, .bars, .stackbar, .legend).
 */
import { h, icon } from '../core/dom.js';
import { formatNumber, percentOf } from './format.js';
import { niceScale } from './chart-scale.js';

/**
 * @param {string} label
 * @param {string} value already formatted
 * @param {{ tone?: string, iconName?: string, detail?: Node | null, href?: string, linkText?: string }} [options]
 *   href: the whole tile becomes a link (e.g. to the list behind the number); linkText is read after the value.
 */
export function kpi(label, value, { tone = '', iconName = '', detail = null, href = '', linkText = '' } = {}) {
  const classes = `kpi${tone ? ` kpi--${tone}` : ''}${href ? ' kpi--link' : ''}`;
  if (href) {
    return h(
      'a',
      { class: classes, href },
      h('p', { class: 'kpi-label' }, iconName ? icon(iconName) : null, label),
      h('p', { class: 'kpi-value' }, value),
      detail,
      linkText ? h('span', { class: 'kpi-link' }, linkText, ' →') : null,
    );
  }
  return h(
    'div',
    { class: classes },
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

/**
 * Card with a horizontal bar chart with axes: one row per item on the Y axis, the count on the X axis
 * (a round 0…max scale with faint grid lines). Single series → one color, no legend: the title names
 * it. Each bar shows its number as text and has a tooltip, so nothing depends on the bar alone.
 * @param {string} title
 * @param {Array<{ label: string, units: number }>} rows in display order (largest first is the caller's choice)
 * @param {{ axisLabel?: string, unit?: [string, string] }} [options] unit: singular / plural for tooltips
 */
export function axisBarChart(title, rows, { axisLabel = 'Cantidad', unit = ['artículo', 'artículos'] } = {}) {
  const titleId = `chart-${Math.random().toString(36).slice(2, 8)}`;
  if (rows.length === 0) {
    return h('section', { class: 'card', 'aria-labelledby': titleId }, h('h2', { id: titleId }, title), h('p', { class: 'muted' }, 'Sin datos todavía.'));
  }
  const scale = niceScale(Math.max(0, ...rows.map((row) => row.units)));
  const total = rows.reduce((sum, row) => sum + row.units, 0);
  const percent = (value) => `${(value / scale.max) * 100}%`;
  const countText = (value) => `${formatNumber(value)} ${value === 1 ? unit[0] : unit[1]}`;
  return h(
    'section',
    { class: 'card axis-chart', 'aria-labelledby': titleId, style: `--intervals:${scale.ticks.length - 1}` },
    h('h2', { id: titleId }, title),
    h(
      'ul',
      { class: 'axis-bars' },
      rows.map((row) =>
        h(
          'li',
          { title: `${row.label}: ${countText(row.units)} · ${percentOf(row.units, total)} %` },
          h('span', { class: 'bar-label' }, row.label),
          h('span', { class: 'axis-track', 'aria-hidden': 'true' }, h('span', { class: 'axis-fill', style: `width:${percent(row.units)}` })),
          h('span', { class: 'bar-value' }, formatNumber(row.units)),
        ),
      ),
    ),
    h(
      'div',
      { class: 'axis-x', 'aria-hidden': 'true' },
      h('span'),
      h('span', { class: 'axis-ticks' }, scale.ticks.map((tick) => h('span', { class: 'axis-tick', style: `left:${percent(tick)}` }, formatNumber(tick)))),
      h('span'),
    ),
    h('p', { class: 'axis-title' }, axisLabel),
  );
}
