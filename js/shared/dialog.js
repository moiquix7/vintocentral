/** Accessible modal dialogs built on the native <dialog> element. */
import { h } from '../core/dom.js';

/**
 * Opens a modal with the given content. Resolves with the value passed to `close(value)`,
 * or `null` if dismissed with Escape.
 * @param {(close: (value: unknown) => void) => { title: string, body: Node, actions: Node[] }} build
 */
export function openModal(build) {
  return new Promise((resolve) => {
    const dialog = h('dialog', { class: 'modal', 'aria-labelledby': 'modal-title' });
    let result = null;
    const close = (value) => {
      result = value;
      dialog.close();
    };
    const { title, body, actions } = build(close);
    dialog.append(
      h('h2', { id: 'modal-title' }, title),
      h('div', { class: 'modal-body' }, body),
      h('div', { class: 'modal-actions' }, actions),
    );
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(result);
    });
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

/** Yes/no confirmation. Resolves true only if the user confirms. */
export async function confirmDialog({ title, message, confirmText = 'Aceptar', danger = false }) {
  const answer = await openModal((close) => ({
    title,
    body: h('p', null, message),
    actions: [
      h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => close(false) }, 'Cancelar'),
      h(
        'button',
        { type: 'button', class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, onclick: () => close(true) },
        confirmText,
      ),
    ],
  }));
  return answer === true;
}
