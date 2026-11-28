/**
 * "Modo fácil" of the inventory-taking (#/inventory/easy): senior-friendly, one question per screen.
 *   1. ¿Qué ubicación va a revisar? (big buttons with the pending count)
 *   2. For each pending article of that location: ¿Dónde está? → ¿En qué estado está? → ¿Está disponible?
 *      → ¿Qué se debería hacer? → ¿Alguna observación? (shared/stepper.js; answers pre-filled, so an
 *      article that is fine only needs «Seguir»)
 *   3. Saved with checkAsset() (same as the grid) → "¡Anotado!" → next article, or "¡Listo!" at the end.
 */
import { h, icon, mount, pageHeader } from '../../core/dom.js';
import { notify } from '../../core/notify.js';
import { AVAILABILITY, CONDITIONS, LIMITS, PROPOSED_ACTIONS } from '../../config/app-config.js';
import { field, input, runSubmit } from '../../shared/form.js';
import { choiceGroup } from '../../shared/choice.js';
import { createStepper } from '../../shared/stepper.js';
import { formatNumber } from '../../shared/format.js';
import { assetStore } from '../assets/asset.store.js';
import { checkAsset } from '../assets/asset.service.js';
import { isUnavailable, sanitizeInventoryUpdate, validateInventoryUpdate } from '../assets/asset.model.js';
import { catalogLookups, catalogOptions, catalogsReady, locationStore } from '../catalogs/catalog.store.js';
import { easyQueue, isChecked, pendingByLocation, storedStatus } from './inventory.model.js';
import { loadRoundStart } from './inventory-round.store.js';

const L = LIMITS.asset;
const ALL = '';
const NO_ACTION = Object.freeze({ '': 'Nada, está bien', ...PROPOSED_ACTIONS });

export async function render(container) {
  await Promise.all([assetStore.whenReady(), catalogsReady()]);
  const roundStart = loadRoundStart();
  const back = h('a', { href: '#/inventory', class: 'btn btn-secondary' }, icon('back'), 'Volver a la tabla');
  const body = h('div', { class: 'stack' });
  mount(container, pageHeader('Modo fácil', back), body);

  let location = ALL;
  let queue = []; // ids, fixed when the location is chosen
  let index = 0;

  const placeName = () => (location ? catalogLookups.locationName(location) : 'todas las ubicaciones');

  /** Screen 1: which location. */
  function chooseLocation() {
    const pending = pendingByLocation(assetStore.getAll(), roundStart);
    const total = [...pending.values()].reduce((sum, count) => sum + count, 0);
    const place = (id, label, count) =>
      h(
        'button',
        { type: 'button', class: 'btn btn-secondary easy-place', disabled: count === 0, onclick: () => start(id) },
        h('span', null, label),
        h('span', { class: 'badge badge--pending' }, count ? `${formatNumber(count)} pendientes` : 'Listo'),
      );
    mount(
      body,
      h(
        'section',
        { class: 'card stack easy-start' },
        h('h2', { class: 'easy-question', tabindex: '-1' }, '¿Qué ubicación va a revisar?'),
        h('p', { class: 'lead' }, 'Le preguntaremos por cada artículo pendiente, una cosa a la vez.'),
        h(
          'div',
          { class: 'easy-places' },
          Object.entries(catalogOptions(locationStore)).map(([id, name]) => place(id, name, pending.get(id) ?? 0)),
          place(ALL, 'Todas las ubicaciones', total),
        ),
      ),
    );
    body.querySelector('h2').focus();
  }

  function start(locationId) {
    location = locationId;
    queue = easyQueue(assetStore.getAll(), location, roundStart).map((asset) => asset.id);
    index = 0;
    showArticle();
  }

  /** Next article still pending (someone else may have verified or deleted it meanwhile). */
  function currentAsset() {
    while (index < queue.length) {
      const asset = assetStore.getById(queue[index]);
      if (asset && !isChecked(asset, roundStart)) return asset;
      index += 1;
    }
    return null;
  }

  /** Screen 2: the questions for one article. */
  function showArticle() {
    const asset = currentAsset();
    if (!asset) {
      finished();
      return;
    }
    const stored = storedStatus(asset);
    const answers = {
      locationId: choiceGroup({ name: 'locationId', label: '¿Dónde está?', options: catalogOptions(locationStore), value: stored.locationId }),
      condition: choiceGroup({ name: 'condition', label: '¿En qué estado está?', options: CONDITIONS, value: stored.condition }),
      availability: choiceGroup({ name: 'availability', label: '¿Está disponible?', options: AVAILABILITY, value: stored.availability }),
      proposedAction: choiceGroup({ name: 'proposedAction', label: '¿Qué se debería hacer?', options: NO_ACTION, value: stored.proposedAction }),
    };
    const texts = {
      unavailableReason: input({ maxlength: L.unavailableReason, value: stored.unavailableReason, placeholder: 'Ej.: Prestado a jóvenes' }),
      proposedActionNote: input({ maxlength: L.proposedActionNote, value: stored.proposedActionNote, placeholder: 'Ej.: Cambiar el cable' }),
      notes: h('textarea', { rows: '3', maxlength: L.notes }, stored.notes),
    };
    const reasonField = field({ label: '¿Por qué no está disponible?', name: 'unavailableReason', control: texts.unavailableReason, wide: true, hint: 'Opcional.' });
    const syncReason = (value) => {
      reasonField.hidden = !isUnavailable(value);
    };
    answers.availability.onChange(syncReason);
    syncReason(stored.availability);

    const values = () => ({
      ...Object.fromEntries(Object.entries(answers).map(([name, group]) => [name, group.value()])),
      ...Object.fromEntries(Object.entries(texts).map(([name, control]) => [name, control.value])),
    });

    const stepper = createStepper({
      label: `Preguntas sobre ${asset.name}`,
      submitLabel: 'Anotar',
      labels: { back: 'Volver', next: 'Seguir' },
      steps: [
        { title: '¿Dónde está?', instructions: 'Si lo movieron, elija dónde está ahora.', fields: ['locationId'], nodes: [answers.locationId.node] },
        { title: '¿En qué estado está?', instructions: 'Mírelo bien y elija una opción.', fields: ['condition'], nodes: [answers.condition.node] },
        { title: '¿Está disponible?', instructions: 'Si no está disponible, puede contar por qué.', fields: ['availability', 'unavailableReason'], nodes: [answers.availability.node, reasonField] },
        {
          title: '¿Qué se debería hacer?',
          instructions: 'Si está bien, deje «Nada, está bien».',
          fields: ['proposedAction', 'proposedActionNote'],
          nodes: [answers.proposedAction.node, field({ label: 'Comentario', name: 'proposedActionNote', control: texts.proposedActionNote, wide: true, hint: 'Opcional.' })],
        },
        { title: '¿Alguna observación?', instructions: 'Opcional. Puede dejarlo vacío y pulsar «Anotar».', fields: ['notes'], nodes: [field({ label: 'Observaciones', name: 'notes', control: texts.notes, wide: true })] },
      ],
      validateStep: () => validateInventoryUpdate(sanitizeInventoryUpdate(values())),
      onSubmit: async () => {
        const ok = await runSubmit(stepper.form, stepper.submitButton, () => checkAsset(asset.id, values()), 'Anotando…', { onInvalid: stepper.revealErrors });
        if (ok) noted(asset);
      },
    });

    const total = queue.length;
    const progress = h('progress', { class: 'progress', max: String(total), value: String(index), 'aria-hidden': 'true' });
    mount(
      body,
      h(
        'section',
        { class: 'card stack-tight', 'aria-label': 'Artículo' },
        h('p', { class: 'stepper-status' }, `Artículo ${formatNumber(index + 1)} de ${formatNumber(total)} · ${placeName()}`),
        progress,
        h('p', { class: 'easy-article' }, h('strong', null, asset.name), asset.code ? ` · ${asset.code}` : ''),
        h('small', { class: 'muted' }, `${catalogLookups.typeName(asset.typeId)} · ${catalogLookups.categoryName(asset.categoryId)}`),
      ),
      stepper.form,
    );
    stepper.goTo(0);
  }

  /** Screen 3: "¡Anotado!" */
  function noted(asset) {
    index += 1;
    const more = Boolean(currentAsset());
    const nextButton = h('button', { type: 'button', class: 'btn btn-primary stepper-next', onclick: showArticle }, more ? 'Siguiente artículo' : 'Ver resultado', icon('back'));
    mount(
      body,
      h(
        'section',
        { class: 'card easy-done', role: 'status' },
        h('span', { class: 'easy-done-mark', 'aria-hidden': 'true' }, icon('check')),
        h('h2', { tabindex: '-1' }, '¡Anotado!'),
        h('p', { class: 'lead' }, `${asset.name} quedó verificado.`),
        h('div', { class: 'button-row' }, h('button', { type: 'button', class: 'btn btn-secondary', onclick: chooseLocation }, 'Terminar'), nextButton),
      ),
    );
    body.querySelector('h2').focus();
  }

  function finished() {
    mount(
      body,
      h(
        'section',
        { class: 'card easy-done', role: 'status' },
        h('span', { class: 'easy-done-mark', 'aria-hidden': 'true' }, icon('check')),
        h('h2', { tabindex: '-1' }, '¡Listo!'),
        h('p', { class: 'lead' }, `No quedan artículos pendientes en ${placeName()}.`),
        h('div', { class: 'button-row' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: chooseLocation }, 'Revisar otra ubicación'), h('a', { href: '#/inventory', class: 'btn btn-secondary' }, 'Volver a la tabla')),
      ),
    );
    body.querySelector('h2').focus();
    notify.success('Toma de inventario de la ubicación terminada.');
  }

  chooseLocation();
  return undefined;
}
