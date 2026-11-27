/**
 * Form, dialogs and leader summary shared by the "Registros" list pages.
 * The same dialog creates (no item) or edits (with item) a record of any kind.
 */
import { h } from '../../core/dom.js';
import { notify, handleError } from '../../core/notify.js';
import { LIMITS } from '../../config/app-config.js';
import { field, input, runSubmit } from '../../shared/form.js';
import { openModal, confirmDialog } from '../../shared/dialog.js';
import { leadersOf, currentLeaders, periodText } from './catalog.model.js';
import { leadersEditor } from './leaders-editor.js';

const L = LIMITS.catalog;

/**
 * @param {object} item current values (empty when adding)
 * @param {boolean} withLeader departments: also the leader history
 */
function itemFields(item, withLeader) {
  const controls = {
    name: input({ maxlength: L.name, value: item.name ?? '', autocomplete: 'off' }),
    description: input({ maxlength: L.description, value: item.description ?? '', autocomplete: 'off' }),
  };
  const nodes = [
    field({ label: 'Nombre', name: 'name', control: controls.name, required: true }),
    field({ label: 'Descripción', name: 'description', control: controls.description, hint: 'Opcional' }),
  ];
  const leaders = withLeader ? leadersEditor(leadersOf(item)) : null;
  if (leaders) {
    // Same structure as field() so form.js can show the "leaders" error under it.
    nodes.push(
      h(
        'div',
        { class: 'field field--wide', dataset: { field: 'leaders' } },
        h('span', { class: 'field-label' }, 'Líderes del departamento'),
        h('p', { class: 'hint' }, 'Opcional. Agregue un líder por cada gestión; deje "Actualidad" si sigue en el cargo.'),
        leaders.node,
        h('p', { class: 'field-error', hidden: true }),
      ),
    );
  }
  return {
    controls,
    nodes,
    values: () => ({
      ...Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value])),
      ...(leaders ? { leaders: leaders.values() } : {}),
    }),
  };
}

/**
 * Opens the add / edit dialog.
 * @param {{ slug: string, noun: string, added: string, service: object, withLeader: boolean }} kind
 * @param {object|null} item null = add a new record
 */
export function openItemForm(kind, item = null) {
  const editing = Boolean(item);
  return openModal((close) => {
    const fields = itemFields(item ?? {}, kind.withLeader);
    const save = h('button', { type: 'submit', class: 'btn btn-primary' }, editing ? 'Guardar' : 'Agregar');
    const form = h('form', { class: 'stack', novalidate: true, 'aria-label': `${editing ? 'Editar' : 'Agregar'} ${kind.noun}` }, fields.nodes);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const action = editing ? () => kind.service.update(item.id, fields.values()) : () => kind.service.create(fields.values());
      if (await runSubmit(form, save, action)) {
        notify.success(editing ? 'Cambios guardados.' : kind.added);
        close(true);
      }
    });
    save.setAttribute('form', (form.id = editing ? `edit-${item.id}` : `add-${kind.slug}`));
    return {
      title: `${editing ? 'Editar' : 'Agregar'} ${kind.noun}`,
      body: form,
      actions: [h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => close(false) }, 'Cancelar'), save],
    };
  });
}

/** Asks first; the service refuses records still used by an article (friendly message). */
export async function removeItem(kind, item) {
  const confirmed = await confirmDialog({
    title: `Eliminar ${kind.noun}`,
    message: `¿Eliminar "${item.name}"? Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await kind.service.remove(item.id);
    notify.success('Eliminado.');
  } catch (error) {
    handleError(error, `remove ${kind.slug}`);
  }
}

/** Current leader(s) in the palette color, plus a collapsible full history. */
export function leaderSummary(item) {
  const leaders = leadersOf(item);
  if (!leaders.length) return h('small', { class: 'muted block' }, 'Sin líder registrado');
  const current = currentLeaders(leaders);
  const headline = current.length
    ? `Líder: ${current.map((l) => `${l.name} (${periodText(l)})`).join(', ')}`
    : `Último líder: ${leaders[0].name} (${periodText(leaders[0])})`;
  return h(
    'div',
    { class: 'leader-summary' },
    h('small', { class: 'block leader-line' }, headline),
    leaders.length > 1
      ? h(
          'details',
          { class: 'leader-history' },
          h('summary', null, `Ver historial (${leaders.length} líderes)`),
          h('ol', null, leaders.map((l) => h('li', null, h('strong', null, l.name), ` · ${periodText(l)}`))),
        )
      : null,
  );
}
