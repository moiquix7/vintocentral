/** Accessible toast notifications (announced by screen readers through aria-live). */
import { h, icon } from './dom.js';
import { toAppError } from './errors.js';

const DURATION_MS = { success: 4000, info: 5000, error: 9000 };

function region() {
  return document.getElementById('toasts');
}

function show(type, message) {
  const container = region();
  if (!container) return;
  const close = () => toast.remove();
  const toast = h(
    'div',
    { class: `toast toast--${type}`, role: type === 'error' ? 'alert' : 'status' },
    h('p', null, message),
    h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Cerrar aviso', onclick: close }, icon('close')),
  );
  container.appendChild(toast);
  setTimeout(close, DURATION_MS[type]);
}

export const notify = Object.freeze({
  success: (message) => show('success', message),
  info: (message) => show('info', message),
  error: (message) => show('error', message),
});

/**
 * Central error handler: logs the technical detail and shows the friendly message.
 * @returns {import('./errors.js').AppError}
 */
export function handleError(error, context = '') {
  const appError = toAppError(error);
  console.error(`[VintoCentral]${context ? ` ${context}:` : ''}`, appError.cause ?? error);
  notify.error(appError.userMessage);
  return appError;
}
