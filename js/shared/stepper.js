/**
 * Step-by-step (wizard) form: one short step visible at a time, a numbered step list with progress,
 * a plain instruction per step, and large Anterior / Siguiente buttons. No domain knowledge.
 *
 * - Siguiente validates only the current step's fields (`validateStep`); errors show under each field.
 * - Enter in a field means Siguiente on intermediate steps (never a premature save).
 * - `freeNavigation` (editing): every step can be opened from the list and the save button is shown on
 *   every step.
 * - `revealErrors(fields)` opens the step holding the first invalid field; pass it to
 *   runSubmit(..., { onInvalid }) so errors returned by a service become visible.
 */
import { h, icon } from '../core/dom.js';
import { clearErrors, showErrors } from './form.js';

/**
 * @param {{
 *   label: string,
 *   steps: Array<{ title: string, instructions: string, nodes: unknown[], fields?: string[] }>,
 *   submitLabel: string,
 *   onSubmit: (stepper: object) => void,
 *   validateStep?: (index: number) => Record<string, string>,
 *   onStepChange?: (index: number) => void,
 *   freeNavigation?: boolean,
 *   cancel?: Node,
 *   compact?: boolean,
 *   labels?: { back?: string, next?: string },
 * }} options
 *   validateStep: errors of any field (only the current step's fields are considered);
 *   onSubmit: runs the save (the stepper only decides when); compact: inside a dialog (panels without cards).
 */
export function createStepper({ label, steps, submitLabel, onSubmit, validateStep, onStepChange, freeNavigation = false, cancel = null, compact = false, labels = {} }) {
  const last = steps.length - 1;
  let current = 0;
  let reached = freeNavigation ? last : 0;

  const stepButtons = steps.map((step, index) =>
    h(
      'button',
      { type: 'button', class: 'stepper-step-button', onclick: () => jump(index) },
      h('span', { class: 'stepper-number', 'aria-hidden': 'true' }),
      h('span', { class: 'stepper-title' }, step.title),
    ),
  );
  const stepItems = stepButtons.map((button) => h('li', { class: 'stepper-step' }, button));
  const status = h('p', { class: 'stepper-status', 'aria-live': 'polite' });
  const progress = h('progress', { class: 'progress', max: String(steps.length), value: '1', 'aria-hidden': 'true' });

  const legends = steps.map((step, index) => h('legend', { tabindex: '-1' }, `${index + 1}. ${step.title}`));
  const panels = steps.map((step, index) =>
    h(
      'fieldset',
      { class: compact ? 'stepper-panel stack' : 'stepper-panel card form-grid', hidden: index !== 0 },
      legends[index],
      h('p', { class: 'field--wide stepper-instructions' }, step.instructions),
      step.nodes,
    ),
  );

  const back = h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => goTo(current - 1) }, icon('back'), labels.back ?? 'Anterior');
  const next = h('button', { type: 'button', class: 'btn btn-primary stepper-next', onclick: advance }, labels.next ?? 'Siguiente', icon('back'));
  const submitButton = h('button', { type: 'submit', class: 'btn btn-primary' }, submitLabel);

  const form = h(
    'form',
    { class: 'stack stepper', novalidate: true, 'aria-label': label },
    h('nav', { class: compact ? 'stepper-progress' : 'stepper-progress card', 'aria-label': 'Pasos del formulario' }, h('ol', { class: 'stepper-steps' }, stepItems), status, progress),
    panels,
    h('div', { class: 'button-row form-actions stepper-nav' }, cancel, back, next, submitButton),
  );

  /** Errors of the given step only. */
  function stepErrors(index) {
    const fields = steps[index].fields ?? [];
    const all = validateStep?.(index) ?? {};
    return Object.fromEntries(Object.entries(all).filter(([name]) => fields.includes(name)));
  }

  function draw() {
    panels.forEach((panel, index) => {
      panel.hidden = index !== current;
    });
    stepItems.forEach((item, index) => {
      const done = index < current || (freeNavigation && index !== current);
      item.classList.toggle('is-current', index === current);
      item.classList.toggle('is-done', index < current);
      const button = stepButtons[index];
      button.disabled = index > reached;
      button.querySelector('.stepper-number').replaceChildren(index < current && !freeNavigation ? icon('check') : String(index + 1));
      if (index === current) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
      button.setAttribute('aria-label', `Paso ${index + 1}: ${steps[index].title}${index === current ? ' (actual)' : done && !freeNavigation ? ' (completado)' : ''}`);
    });
    status.textContent = `Paso ${current + 1} de ${steps.length} · ${steps[current].title}`;
    progress.value = String(current + 1);
    back.hidden = current === 0;
    next.hidden = current === last;
    submitButton.hidden = !freeNavigation && current !== last;
  }

  /**
   * @param {number} index
   * @param {{ focus?: boolean }} [options] focus the step heading (not when an error field will take the focus)
   */
  function goTo(index, { focus = true } = {}) {
    if (index < 0 || index > last) return;
    current = index;
    reached = Math.max(reached, index);
    draw();
    onStepChange?.(index);
    if (focus) legends[index].focus();
  }

  /** Siguiente: only when the current step is valid. */
  function advance() {
    const errors = stepErrors(current);
    if (Object.keys(errors).length) {
      showErrors(form, errors);
      return false;
    }
    clearErrors(form);
    goTo(current + 1);
    return true;
  }

  /** Step list: backwards always; forwards only through valid steps (free navigation: anywhere). */
  function jump(index) {
    if (index === current) return;
    if (freeNavigation || index < current) {
      clearErrors(form);
      goTo(index);
      return;
    }
    while (current < index) {
      if (!advance()) return;
    }
  }

  /** Opens the step that holds the first invalid field (fields in no step are ignored). */
  function revealErrors(fields) {
    const names = Object.keys(fields ?? {});
    const index = steps.findIndex((step) => names.some((name) => (step.fields ?? []).includes(name)));
    if (index >= 0 && index !== current) goTo(index, { focus: false });
  }

  const api = {
    form,
    submitButton,
    goTo,
    revealErrors,
    get current() {
      return current;
    },
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!freeNavigation && current < last) {
      advance();
      return;
    }
    onSubmit(api);
  });

  draw();
  return api;
}
