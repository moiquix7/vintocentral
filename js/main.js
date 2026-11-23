/**
 * Entry point. Applies display preferences, installs global error handlers, checks the Firebase
 * configuration and only then loads the application (so a missing config or a network failure
 * shows a clear message instead of a blank page).
 */
import { firebaseConfig } from './config/firebase-config.js';
import { isFirebaseConfigured } from './core/config-check.js';
import { applyPreferences } from './core/preferences.js';
import { handleError } from './core/notify.js';
import { h, mount } from './core/dom.js';
import { APP } from './config/app-config.js';

applyPreferences();

window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  handleError(event.reason, 'unhandled promise');
});
window.addEventListener('error', (event) => {
  // Resource load errors (img/script) have no `error`; they are handled where they happen.
  if (event.error) handleError(event.error, 'uncaught');
});

function showFatal(root, title, message) {
  root.removeAttribute('aria-busy');
  mount(
    root,
    h(
      'main',
      { class: 'login', id: 'main' },
      h(
        'section',
        { class: 'card login-card', role: 'alert' },
        h('img', { src: APP.logo, alt: '', class: 'login-logo', width: '84', height: '84' }),
        h('h1', null, title),
        h('p', null, message),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => location.reload() }, 'Reintentar'),
      ),
    ),
  );
}

async function boot() {
  const root = document.getElementById('app');
  if (!isFirebaseConfigured(firebaseConfig)) {
    showFatal(
      root,
      'Falta configurar Firebase',
      'Complete js/config/firebase-config.js con los datos de la aplicación web de Firebase (vea docs/deployment.md).',
    );
    return;
  }
  try {
    const { startApp } = await import('./app.js');
    await startApp(root);
  } catch (error) {
    console.error('[VintoCentral] startup failed', error);
    showFatal(root, 'No se pudo iniciar', 'Revise su conexión a internet y vuelva a intentar.');
  }
}

boot();
