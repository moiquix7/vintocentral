/**
 * Application shell for signed-in pages: header (logo, user menu), navigation filtered by
 * permission, and <main id="main"> where views render.
 * The user menu (avatar button) holds: Mi perfil, appearance (theme, colors, focus mode,
 * text size) and Salir. A sun/moon button next to it switches light ↔ dark in one tap.
 */
import { h, icon, mount } from '../../core/dom.js';
import { session, endSession } from '../../core/session.js';
import { navigate } from '../../core/router.js';
import { APP, ROLES } from '../../config/app-config.js';
import { avatar } from '../../shared/avatar.js';
import { appearanceControls, themeToggle } from '../../shared/appearance.js';
import { NAV_ITEMS } from '../../config/navigation.js';

let shell = null; // { root, main, nav, key, menu, toggle }

export function shellKey(profile) {
  return profile ? [profile.uid, profile.role, profile.displayName, profile.username, profile.photoUrl].join('|') : '';
}

function buildNav() {
  return h(
    'ul',
    { class: 'nav-list' },
    NAV_ITEMS.filter((item) => session.can(item.permission)).map((item) =>
      h('li', null, h('a', { href: `#${item.path}`, dataset: { path: item.path } }, icon(item.icon), h('span', null, item.label))),
    ),
  );
}

/** Disclosure dropdown: button[aria-expanded] + panel. Closes on Escape, outside click or navigation. */
function userMenu(profile) {
  const appearance = appearanceControls();
  const button = h(
    'button',
    { type: 'button', class: 'user-button', 'aria-expanded': 'false', 'aria-controls': 'user-menu', 'aria-haspopup': 'true' },
    avatar(profile, { size: 38 }),
    h('span', { class: 'user-button-name' }, profile.displayName),
    icon('chevron'),
  );
  button.setAttribute('aria-label', `Menú de usuario: ${profile.displayName}`);

  const close = (returnFocus = false) => {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (returnFocus) button.focus();
  };
  const open = () => {
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    panel.querySelector('a, button, input, select')?.focus();
  };

  const panel = h(
    'div',
    { class: 'user-menu', id: 'user-menu', hidden: true },
    h(
      'div',
      { class: 'user-menu-head' },
      avatar(profile, { size: 52 }),
      h(
        'div',
        null,
        h('strong', null, profile.displayName),
        profile.username ? h('small', { class: 'muted block' }, `@${profile.username}`) : null,
        h('small', { class: 'muted block' }, ROLES[profile.role]),
      ),
    ),
    h(
      'button',
      { type: 'button', class: 'menu-item', onclick: () => { close(); navigate('/profile'); } },
      icon('user'),
      'Mi perfil',
    ),
    h('div', { class: 'menu-section' }, h('p', { class: 'menu-title' }, 'Apariencia'), appearance.node),
    h('button', { type: 'button', class: 'menu-item menu-item--danger', onclick: () => endSession() }, icon('logout'), 'Salir'),
  );

  button.addEventListener('click', () => (panel.hidden ? open() : close()));
  const onKey = (event) => {
    if (event.key === 'Escape' && !panel.hidden) close(true);
  };
  const onOutside = (event) => {
    if (!panel.hidden && !wrapper.contains(event.target)) close();
  };
  document.addEventListener('keydown', onKey);
  document.addEventListener('click', onOutside);

  const wrapper = h('div', { class: 'user-box' }, button, panel);
  return {
    node: wrapper,
    close,
    dispose() {
      appearance.dispose();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onOutside);
    },
  };
}

function build(root) {
  const profile = session.profile;
  const nav = h('nav', { class: 'app-nav', id: 'app-nav', 'aria-label': 'Menú principal' }, buildNav());
  const menuButton = h(
    'button',
    { type: 'button', class: 'btn-icon menu-button', 'aria-expanded': 'false', 'aria-controls': 'app-nav', 'aria-label': 'Abrir menú' },
    icon('menu'),
  );
  menuButton.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      nav.classList.remove('is-open');
      menuButton.setAttribute('aria-expanded', 'false');
    }
  });

  const main = h('main', { id: 'main', class: 'app-main', tabindex: '-1' });
  const skip = h('a', { href: '#', class: 'skip-link' }, 'Saltar al contenido');
  skip.addEventListener('click', (event) => {
    event.preventDefault();
    main.querySelector('h1')?.focus();
  });

  const menu = userMenu(profile);
  const toggle = themeToggle();
  mount(
    root,
    skip,
    h(
      'header',
      { class: 'app-header' },
      h(
        'a',
        { class: 'brand', href: session.can('dashboard.view') ? '#/dashboard' : '#/assets' },
        h('img', { src: APP.logo, alt: '', width: '36', height: '36', class: 'brand-logo' }),
        h('span', { class: 'brand-name' }, APP.name),
      ),
      h('div', { class: 'header-actions' }, toggle.node, menu.node, menuButton),
    ),
    h('div', { class: 'app-body' }, nav, main),
  );
  return { root, main, nav, key: shellKey(profile), menu, toggle };
}

/** Returns the <main> element, (re)building the shell when missing or when the profile changed. */
export function ensureShell(root) {
  const key = shellKey(session.profile);
  if (!shell || shell.root !== root || !root.contains(shell.main) || shell.key !== key) {
    disposeShell();
    shell = build(root);
  }
  shell.menu.close();
  return shell.main;
}

function disposeShell() {
  shell?.menu.dispose();
  shell?.toggle.dispose();
}

export function destroyShell() {
  disposeShell();
  shell = null;
}

/** Highlights the navigation entry that matches the current path. */
export function setActiveNav(path) {
  if (!shell) return;
  shell.nav.querySelectorAll('a').forEach((link) => {
    const active = path === link.dataset.path || path.startsWith(`${link.dataset.path}/`);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}
