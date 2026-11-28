/**
 * Eye-friendly chart building blocks (no domain knowledge): KPI tile, horizontal bar list, 100 %
 * segmented bar with legend and horizontal bar chart with axes. Numbers are always text; bars are
 * decorative and carry a tooltip, so nothing depends on color alone.
 * Styles: css/components.css (.kpis, .kpi, .chart-card, .bars, .stackbar, .legend, .axis-chart).
 */
import { h, icon } from '../core/dom.js';
import { formatNumber, percentOf } from './format.js';
import { niceScale } from './chart-scale.js';

const BADGE_TONES = Object.freeze(['good', 'bad', 'neutral']);

/**
 * One tile of the KPI strip (`<section class="kpis">`).
 * @param {string} label
 * @param {string | Node} value already formatted (or a loader)
 * @param {{ tone?: string, iconName?: string, detail?: Node | null, href?: string, linkText?: string, pulse?: boolean,
 *   badge?: { text: string, tone?: 'good' | 'bad' | 'neutral' } | null }} [options]
 *   tone: '' | 'warn' | 'alert' (red). href: the whole tile becomes a link (e.g. to the list behind the
 *   number); linkText is read after the value. pulse: a short, soft pulse to draw the eye (3 cycles, none
 *   with reduced motion or focus mode) — the caller decides when, so redraws do not repeat it.
 *   badge: small pill next to the value; only for figures derived from real data (never invented trends).
 */
export function kpi(label, value, { tone = '', iconName = '', detail = null, href = '', linkText = '', pulse = false, badge = null } = {}) {
  const classes = `kpi${tone ? ` kpi--${tone}` : ''}${href ? ' kpi--link' : ''}${pulse ? ' kpi--pulse' : ''}`;
  const badgeTone = BADGE_TONES.includes(badge?.tone) ? badge.tone : 'neutral';
  const content = [
    iconName ? h('span', { class: 'kpi-icon', 'aria-hidden': 'true' }, icon(iconName)) : null,
    h('p', { class: 'kpi-label' }, label),
    h(
      'div',
      { class: 'kpi-row' },
      h('p', { class: 'kpi-value' }, value),
      badge?.text ? h('span', { class: `kpi-badge kpi-badge--${badgeTone}` }, badge.text) : null,
    ),
    detail,
    href && linkText ? h('span', { class: 'kpi-link' }, linkText, ' →') : null,
  ];
  return href ? h('a', { class: classes, href }, content) : h('div', { class: classes }, content);
}

function shareText(units, total) {
  return `${formatNumber(units)} unidades · ${percentOf(units, total)} %`;
}

/**
 * Card shell shared by every chart: title, optional summary line (bold total + muted context), body.
 * @param {string} title
 * @param {{ total?: number | null, totalText?: string, context?: string, className?: string, style?: string }} summary
 * @param {...(Node | Node[] | null)} body
 */
function chartCard(title, { total = null, totalText = '', context = '', className = '', style = '' }, ...body) {
  const titleId = `chart-${Math.random().toString(36).slice(2, 8)}`;
  return h(
    'section',
    { class: `card chart-card${className ? ` ${className}` : ''}`, 'aria-labelledby': titleId, style: style || null },
    h(
      'header',
      { class: 'chart-head' },
      h('h2', { id: titleId }, title),
      total !== null
        ? h('p', { class: 'chart-summary' }, h('strong', null, formatNumber(total)), totalText ? ` ${totalText}` : '', context ? h('span', { class: 'muted' }, ` · ${context}`) : null)
        : null,
    ),
    body,
  );
}

const noData = () => h('p', { class: 'muted' }, 'Sin datos todavía.');

/**
 * Card with a horizontal bar per row (largest first is the caller's choice).
 * @param {string} title
 * @param {Array<{ label: string, units: number }>} rows
 * @param {{ item?: [string, string] }} [options] item: singular / plural of a row, for the summary line
 */
export function barList(title, rows, { item = ['grupo', 'grupos'] } = {}) {
  const max = Math.max(1, ...rows.map((r) => r.units));
  const total = rows.reduce((sum, r) => sum + r.units, 0);
  return chartCard(
    title,
    { total: rows.length ? total : null, totalText: total === 1 ? 'unidad' : 'unidades', context: `en ${formatNumber(rows.length)} ${rows.length === 1 ? item[0] : item[1]}` },
    rows.length === 0
      ? noData()
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
  return chartCard(
    title,
    { total: total ? total : null, totalText: total === 1 ? 'unidad' : 'unidades' },
    total === 0
      ? noData()
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
 * (a round 0…max scale with dashed grid lines, ~20 % headroom so the value after the longest bar fits).
 * Single series → one color, no legend: the title names it. Each bar has its number written right after
 * it and a tooltip, so nothing depends on the bar alone.
 * @param {string} title
 * @param {Array<{ label: string, units: number }>} rows in display order (largest first is the caller's choice)
 * @param {{ axisLabel?: string, unit?: [string, string], item?: [string, string] }} [options]
 *   unit: singular / plural of what is counted (tooltips, summary); item: singular / plural of a row (summary)
 */
export function axisBarChart(title, rows, { axisLabel = 'Cantidad', unit = ['artículo', 'artículos'], item = ['grupo', 'grupos'] } = {}) {
  const total = rows.reduce((sum, row) => sum + row.units, 0);
  const plural = (value, [one, many]) => `${formatNumber(value)} ${value === 1 ? one : many}`;
  const summary = { total, totalText: total === 1 ? unit[0] : unit[1], context: `en ${plural(rows.length, item)}` };
  if (rows.length === 0) return chartCard(title, { total: null }, noData());

  const scale = niceScale(Math.max(0, ...rows.map((row) => row.units)) * 1.25);
  const percent = (value) => `${(value / scale.max) * 100}%`;
  return chartCard(
    title,
    { ...summary, className: 'axis-chart' },
    h(
      'div',
      { class: 'axis-plot' },
      h('div', { class: 'axis-grid', 'aria-hidden': 'true' }, scale.ticks.map((tick) => h('span', { class: 'axis-gridline', style: `left:${percent(tick)}` }))),
      h(
        'ul',
        { class: 'axis-bars' },
        rows.map((row) =>
          h(
            'li',
            { title: `${row.label}: ${plural(row.units, unit)} · ${percentOf(row.units, total)} %` },
            h('span', { class: 'bar-label' }, row.label),
            h(
              'span',
              { class: 'axis-track' },
              h('span', { class: 'axis-fill', style: `width:${percent(row.units)}`, 'aria-hidden': 'true' }),
              h('span', { class: 'axis-value', style: `left:${percent(row.units)}` }, formatNumber(row.units)),
            ),
          ),
        ),
      ),
    ),
    h(
      'div',
      { class: 'axis-x', 'aria-hidden': 'true' },
      h('span'),
      h('span', { class: 'axis-ticks' }, scale.ticks.map((tick) => h('span', { class: 'axis-tick', style: `left:${percent(tick)}` }, formatNumber(tick)))),
    ),
    h('p', { class: 'axis-title' }, axisLabel),
  );
}
