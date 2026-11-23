/**
 * Login page: church photo background, logo, username (or email) + password,
 * and theme/color controls so the chosen look applies from the very first screen.
 * A signed-in user is forwarded to the dashboard.
 */
import { h, mount } from '../../core/dom.js';
import { session } from '../../core/session.js';
import { navigate, HOME_PATH } from '../../core/router.js';
import { notify } from '../../core/notify.js';
import { APP, LIMITS } from '../../config/app-config.js';
import { field, input, runSubmit } from '../../shared/form.js';
import { appearanceControls } from '../../shared/appearance.js';
import { signIn, requestPasswordReset } from './auth.service.js';

export async function render(container) {
  if (session.isAuthenticated) {
    navigate(HOME_PATH);
    return undefined;
  }

  const identifier = input({
    autocomplete: 'username',
    autocapitalize: 'none',
    spellcheck: 'false',
    maxlength: LIMITS.user.email,
  });
  const password = input({ type: 'password', autocomplete: 'current-password', maxlength: LIMITS.user.maxPassword });
  const toggle = h('button', { type: 'button', class: 'btn btn-link', 'aria-pressed': 'false' }, 'Mostrar contraseña');
  toggle.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    toggle.textContent = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';
    toggle.setAttribute('aria-pressed', String(visible));
  });

  const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Ingresar');
  const forgot = h('button', { type: 'button', class: 'btn btn-link' }, '¿Olvidó su contraseña?');

  const form = h(
    'form',
    { class: 'stack', novalidate: true, 'aria-label': 'Ingreso' },
    field({ label: 'Usuario', name: 'identifier', control: identifier, required: true, hint: 'Su nombre de usuario (o su correo).' }),
    field({ label: 'Contraseña', name: 'password', control: password, required: true }),
    toggle,
    submit,
    forgot,
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    // On success the session listener in app.js moves to the dashboard.
    await runSubmit(form, submit, () => signIn(identifier.value, password.value), 'Ingresando…');
  });

  forgot.addEventListener('click', async () => {
    const ok = await runSubmit(form, forgot, () => requestPasswordReset(identifier.value), 'Enviando…');
    if (ok) notify.success('Si el usuario está registrado, recibirá un correo para cambiar su contraseña.');
  });

  const appearance = appearanceControls({ compact: true });

  mount(
    container,
    h(
      'main',
      // Absolute URL: a relative url() inside a CSS variable would resolve against css/, not the page.
      { class: 'login', id: 'main', style: `--login-image:url("${new URL(APP.loginBackground, document.baseURI).href}")` },
      h(
        'section',
        { class: 'card login-card' },
        h('img', { src: APP.logo, alt: `Logo de la ${APP.churchName}`, class: 'login-logo', width: '84', height: '84' }),
        h('h1', { tabindex: '-1' }, APP.name),
        h('p', { class: 'muted' }, APP.churchName),
        form,
        h('details', { class: 'login-appearance' }, h('summary', null, 'Apariencia'), appearance.node),
      ),
    ),
  );
  identifier.focus();
  return () => appearance.dispose();
}
