/**
 * Login page ("don't make me think"): church photo background, logo, church name (h1),
 * system name, two fields with icons, one primary button and the password-reset link.
 * Appearance is not offered here: it uses the preferences already saved in the browser.
 * A signed-in user is forwarded to their home page.
 * Below the form: who to contact for an account (APP.adminContact).
 */
import { h, icon, mount } from '../../core/dom.js';
import { session } from '../../core/session.js';
import { navigateHome } from '../../core/router.js';
import { notify } from '../../core/notify.js';
import { APP, LIMITS } from '../../config/app-config.js';
import { field, input, runSubmit } from '../../shared/form.js';
import { signIn, requestPasswordReset } from './auth.service.js';

/** Eye button inside the password field that shows/hides the typed text. */
function passwordToggle(password) {
  const button = h('button', { type: 'button', class: 'btn-icon', 'aria-pressed': 'false' });
  const sync = () => {
    const visible = password.type === 'text';
    const label = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';
    button.replaceChildren(icon(visible ? 'eyeOff' : 'eye'));
    button.setAttribute('aria-label', label);
    button.title = label;
    button.setAttribute('aria-pressed', String(visible));
  };
  button.addEventListener('click', () => {
    password.type = password.type === 'password' ? 'text' : 'password';
    sync();
    password.focus();
  });
  sync();
  return button;
}

/**
 * "¿No tiene cuenta?" box: the system administrator and how to reach them.
 * Email and phone come from APP.adminContact; an empty value is not shown.
 */
function adminContactBox() {
  const { name, role, email, phone } = APP.adminContact;
  const digits = phone.replace(/[^\d]/g, '');
  const links = [
    email ? h('a', { href: `mailto:${email}`, class: 'contact-link' }, icon('mail'), email) : null,
    digits ? h('a', { href: `tel:+${digits}`, class: 'contact-link' }, icon('phone'), phone) : null,
    digits
      ? h('a', { href: `https://wa.me/${digits}`, class: 'contact-link', target: '_blank', rel: 'noopener noreferrer' }, icon('chat'), 'WhatsApp')
      : null,
  ].filter(Boolean);
  return h(
    'aside',
    { class: 'login-help', 'aria-label': 'Ayuda para obtener una cuenta' },
    h('p', { class: 'login-help-title' }, '¿No tiene cuenta?'),
    h('p', null, 'Las cuentas las crea el administrador del sistema. Comuníquese con:'),
    h('p', { class: 'login-help-name' }, h('strong', null, name), h('small', { class: 'muted block' }, role)),
    links.length ? h('div', { class: 'contact-links' }, links) : null,
    h('p', { class: 'muted login-help-note' }, 'Si olvidó su contraseña, use «¿Olvidó su contraseña?» arriba.'),
  );
}

export async function render(container) {
  if (session.isAuthenticated) {
    navigateHome();
    return undefined;
  }

  const identifier = input({
    autocomplete: 'username',
    autocapitalize: 'none',
    spellcheck: 'false',
    placeholder: 'Ej.: jperez o jperez@correo.com',
    maxlength: LIMITS.user.email,
  });
  const password = input({
    type: 'password',
    autocomplete: 'current-password',
    placeholder: 'Su contraseña',
    maxlength: LIMITS.user.maxPassword,
  });

  const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Ingresar');
  const forgot = h('button', { type: 'button', class: 'btn btn-link login-forgot' }, '¿Olvidó su contraseña?');

  const form = h(
    'form',
    { class: 'stack', novalidate: true, 'aria-label': 'Ingreso' },
    field({ label: 'Usuario o correo', name: 'identifier', control: identifier, required: true, icon: 'user' }),
    field({
      label: 'Contraseña',
      name: 'password',
      control: password,
      required: true,
      icon: 'lock',
      action: passwordToggle(password),
    }),
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
        h('h1', { tabindex: '-1' }, APP.churchFullName),
        h('p', { class: 'login-subtitle' }, APP.systemName),
        form,
        adminContactBox(),
      ),
    ),
  );
  identifier.focus();
  return undefined;
}
