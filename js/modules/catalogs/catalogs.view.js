/**
 * Departments (stored as `categories`) and locations management: one reusable panel, used twice.
 * Departments also keep a leader history (name + gestión years, picked from dropdowns).
 */
import { h, icon, mount, pageHeader } from '../../core/dom.js';
import { notify, handleError } from '../../core/notify.js';
import { LIMITS } from '../../config/app-config.js';
import { field, input, runSubmit } from '../../shared/form.js';
import { openModal, confirmDialog } from '../../shared/dialog.js';
import { categoryStore, locationStore } from './catalog.store.js';
import { categoryService, locationService } from './catalog.service.js';
import { leadersOf, currentLeaders, periodText } from './catalog.model.js';
import { leadersEditor } from './leaders-editor.js';

const L = LIMITS.catalog;

/**
 * @param {object} item current values (empty when adding)
 * @param {boolean} withLeader departments: also the leader history
 */
function itemFields(item = {}, withLeader = false) {
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
    reset: () => leaders?.reset(),
  };
}

/** Current leader(s) in the palette color, plus a collapsible full history. */
function leaderSummary(item) {
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

function editItem(service, item, noun, withLeader) {
  return openModal((close) => {
    const fields = itemFields(item, withLeader);
    const save = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Guardar');
    const form = h('form', { class: 'stack', novalidate: true, 'aria-label': `Editar ${noun}` }, fields.nodes);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (await runSubmit(form, save, () => service.update(item.id, fields.values()))) {
        notify.success('Cambios guardados.');
        close(true);
      }
    });
    save.setAttribute('form', (form.id = `edit-${item.id}`));
    return {
      title: `Editar ${noun}`,
      body: form,
      actions: [h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => close(false) }, 'Cancelar'), save],
    };
  });
}

async function removeItem(service, item, noun) {
  const confirmed = await confirmDialog({
    title: `Eliminar ${noun}`,
    message: `¿Eliminar "${item.name}"?`,
    confirmText: 'Eliminar',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await service.remove(item.id);
    notify.success('Eliminado.');
  } catch (error) {
    handleError(error, `remove ${noun}`);
  }
}

/**
 * @param {{ title: string, noun: string, added: string, store: object, service: object, withLeader?: boolean }} config
 * @returns {{ node: HTMLElement, dispose: () => void }}
 */
function catalogPanel({ title, noun, added, store, service, withLeader = false }) {
  const list = h('ul', { class: 'item-list' });
  const fields = itemFields({}, withLeader);
  const add = h('button', { type: 'submit', class: 'btn btn-primary' }, icon('plus'), `Agregar ${noun}`);
  const form = h('form', { class: 'stack', novalidate: true, 'aria-label': `Agregar ${noun}` }, fields.nodes, add);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (await runSubmit(form, add, () => service.create(fields.values()))) {
      notify.success(added);
      form.reset();
      fields.reset();
      fields.controls.name.focus();
    }
  });

  function draw() {
    const items = store.getAll();
    mount(
      list,
      items.length === 0
        ? h('li', { class: 'muted' }, 'Todavía no hay registros.')
        : items.map((item) =>
            h(
              'li',
              null,
              h(
                'div',
                null,
                h('strong', null, item.name),
                withLeader ? leaderSummary(item) : null,
                item.description ? h('small', { class: 'muted block' }, item.description) : null,
              ),
              h(
                'div',
                { class: 'button-row' },
                h('button', { type: 'button', class: 'btn btn-secondary btn-small', 'aria-label': `Editar ${item.name}`, onclick: () => editItem(service, item, noun, withLeader) }, icon('edit'), 'Editar'),
                h('button', { type: 'button', class: 'btn btn-danger btn-small', 'aria-label': `Eliminar ${item.name}`, onclick: () => removeItem(service, item, noun) }, icon('trash'), 'Eliminar'),
              ),
            ),
          ),
    );
  }

  draw();
  const dispose = store.subscribe(draw);
  return { node: h('section', { class: 'card' }, h('h2', null, title), form, list), dispose };
}

export async function render(container) {
  await Promise.all([categoryStore.whenReady(), locationStore.whenReady()]);
  const panels = [
    catalogPanel({
      title: 'Departamentos',
      noun: 'departamento',
      added: 'Departamento agregado.',
      store: categoryStore,
      service: categoryService,
      withLeader: true,
    }),
    catalogPanel({ title: 'Ubicaciones', noun: 'ubicación', added: 'Ubicación agregada.', store: locationStore, service: locationService }),
  ];
  mount(
    container,
    pageHeader('Departamentos y ubicaciones'),
    h('p', { class: 'muted' }, 'Los departamentos agrupan los bienes según quién los usa (ej.: Jóvenes, Escuela Sabática, Música). Las ubicaciones dicen dónde están (ej.: Templo, Salón de jóvenes).'),
    h('div', { class: 'grid-2' }, panels.map((p) => p.node)),
  );
  return () => panels.forEach((p) => p.dispose());
}
