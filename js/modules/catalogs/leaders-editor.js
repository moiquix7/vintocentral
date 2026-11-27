/**
 * Editable leader history of a department: one row per leader with name, "Desde" year and
 * "Hasta" year (or "Actualidad"). Years are picked from dropdowns (newest first).
 */
import { h, icon, mount } from '../../core/dom.js';
import { LIMITS } from '../../config/app-config.js';
import { yearOptions } from './catalog.model.js';

const L = LIMITS.catalog;
const CURRENT = ''; // value of the "Actualidad" option

function yearSelect(selected, { label, withCurrent }) {
  const value = selected === null || selected === undefined ? CURRENT : String(selected);
  return h(
    'select',
    { 'aria-label': label },
    withCurrent ? h('option', { value: CURRENT, selected: value === CURRENT }, 'Actualidad') : null,
    yearOptions().map((year) => h('option', { value: String(year), selected: String(year) === value }, String(year))),
  );
}

/**
 * @param {Array<{ name: string, from: number|null, to: number|null }>} initial
 * @returns {{ node: HTMLElement, values: () => object[], reset: () => void }}
 */
export function leadersEditor(initial = []) {
  let rows = [];
  const list = h('ol', { class: 'leader-rows' });
  const empty = h('p', { class: 'muted' }, 'Sin líderes registrados.');
  const addButton = h('button', { type: 'button', class: 'btn btn-secondary' }, icon('plus'), 'Agregar líder');

  function renumber() {
    rows.forEach((row, index) => {
      row.title.textContent = `Líder ${index + 1}`;
      row.remove.setAttribute('aria-label', `Quitar líder ${index + 1}`);
    });
    empty.hidden = rows.length > 0;
    addButton.disabled = rows.length >= L.maxLeaders;
  }

  function addRow(leader = {}, focus = false) {
    const name = h('input', { type: 'text', maxlength: L.leader, value: leader.name ?? '', autocomplete: 'off', placeholder: 'Nombre completo' });
    const from = yearSelect(leader.from ?? new Date().getFullYear(), { label: 'Desde', withCurrent: false });
    const to = yearSelect(leader.to ?? null, { label: 'Hasta', withCurrent: true });
    const title = h('span', { class: 'leader-title' });
    const remove = h('button', { type: 'button', class: 'btn btn-danger btn-small' }, icon('trash'), 'Quitar');
    const item = h(
      'li',
      { class: 'leader-row' },
      title,
      h('label', { class: 'leader-name' }, h('span', null, 'Nombre'), name),
      h('label', null, h('span', null, 'Desde'), from),
      h('label', null, h('span', null, 'Hasta'), to),
      remove,
    );
    const row = { item, name, from, to, title, remove };
    remove.addEventListener('click', () => {
      rows = rows.filter((r) => r !== row);
      item.remove();
      renumber();
      (rows.at(-1)?.name ?? addButton).focus();
    });
    rows.push(row);
    list.appendChild(item);
    renumber();
    if (focus) name.focus();
  }

  function reset(leaders = []) {
    rows = [];
    mount(list);
    leaders.forEach((leader) => addRow(leader));
    renumber();
  }

  addButton.addEventListener('click', () => addRow({}, true));
  reset(initial);

  return {
    node: h('div', { class: 'leaders-editor' }, empty, list, addButton),
    values: () => rows.map((row) => ({ name: row.name.value, from: row.from.value, to: row.to.value })),
    reset: () => reset([]),
  };
}
