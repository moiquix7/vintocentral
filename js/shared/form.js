/**
 * Accessible form building blocks: labelled fields with hint and inline error,
 * plus helpers to show/clear validation errors.
 */
import { h, icon as svgIcon, inventoryLoader } from '../core/dom.js';
import { ValidationError } from '../core/errors.js';
import { notify, handleError } from '../core/notify.js';

let fieldCounter = 0;

/**
 * @param {{ label: string, name: string, control: HTMLElement, hint?: string, required?: boolean, wide?: boolean,
 *   icon?: string, prefix?: string, action?: HTMLElement }} options
 *   icon: name of a dom.js icon shown inside the control, on the left;
 *   prefix: short text shown inside the control, on the left (e.g. the currency "Bs.");
 *   action: small button shown inside the control, on the right (e.g. show password).
 */
export function field({ label, name, control, hint, required = false, wide = false, icon, prefix, action }) {
  const id = `f-${name}-${++fieldCounter}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  control.id = id;
  control.name = name;
  if (required) control.required = true;
  control.setAttribute('aria-describedby', [hint ? hintId : '', errorId].filter(Boolean).join(' '));
  return h(
    'div',
    { class: `field${wide ? ' field--wide' : ''}`, dataset: { field: name } },
    h('label', { for: id }, label, required ? h('span', { class: 'required', 'aria-hidden': 'true' }, ' *') : null),
    hint ? h('p', { class: 'hint', id: hintId }, hint) : null,
    icon || prefix || action ? decorate(control, { icon, prefix, action }) : control,
    h('p', { class: 'field-error', id: errorId, hidden: true }),
  );
}

function decorate(control, { icon, prefix, action }) {
  const classes = ['input-addon', icon ? 'input-addon--icon' : '', prefix ? 'input-addon--prefix' : '', action ? 'input-addon--action' : ''];
  return h(
    'div',
    { class: classes.filter(Boolean).join(' ') },
    icon ? svgIcon(icon) : null,
    prefix ? h('span', { class: 'input-prefix', 'aria-hidden': 'true' }, prefix) : null,
    control,
    action ?? null,
  );
}

export function input(props = {}) {
  return h('input', { type: 'text', ...props });
}

/** @param {Record<string, string>} options value → label */
export function select(options, { value = '', placeholder = null, ...props } = {}) {
  return h(
    'select',
    props,
    placeholder !== null ? h('option', { value: '' }, placeholder) : null,
    Object.entries(options).map(([key, label]) => h('option', { value: key, selected: key === value }, label)),
  );
}

export function clearErrors(form) {
  form.querySelectorAll('.field-error').forEach((p) => {
    p.textContent = '';
    p.hidden = true;
  });
  form.querySelectorAll('[aria-invalid]').forEach((c) => c.removeAttribute('aria-invalid'));
}

/** Shows each message under its field and focuses the first invalid control. */
export function showErrors(form, errors) {
  clearErrors(form);
  let first = null;
  for (const [name, message] of Object.entries(errors)) {
    const wrapper = form.querySelector(`[data-field="${CSS.escape(name)}"]`);
    if (!wrapper) continue;
    const error = wrapper.querySelector('.field-error');
    const control = wrapper.querySelector('input, select, textarea');
    error.textContent = message;
    error.hidden = false;
    control?.setAttribute('aria-invalid', 'true');
    first ??= control;
  }
  first?.focus();
}

/**
 * Runs an async submit action with the button disabled and consistent error handling:
 * validation errors go inline, everything else becomes a toast.
 * @param {{ onInvalid?: (fields: Record<string, string>) => void }} [options]
 *   onInvalid: called with the invalid fields before they are shown (e.g. a step-by-step form opens
 *   the step that holds them, so the messages are visible and the focus can land on them)
 * @returns {Promise<boolean>} true when the action succeeded
 */
export async function runSubmit(form, button, action, busyText = 'Guardando…', { onInvalid } = {}) {
  const originalContent = [...button.childNodes];
  button.disabled = true;
  button.replaceChildren(inventoryLoader({ label: busyText, size: 'small' }));
  form.setAttribute('aria-busy', 'true');
  clearErrors(form);
  try {
    await action();
    return true;
  } catch (error) {
    if (error instanceof ValidationError) {
      onInvalid?.(error.fields);
      showErrors(form, error.fields);
      notify.error(error.userMessage);
    } else {
      handleError(error, form.getAttribute('aria-label') ?? 'form');
    }
    return false;
  } finally {
    button.disabled = false;
    button.replaceChildren(...originalContent);
    form.removeAttribute('aria-busy');
  }
}
