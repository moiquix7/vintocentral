/**
 * Application composition: routes, session → stores wiring, and where each view renders.
 * Loaded by main.js only after the Firebase configuration has been checked.
 */
import { session, startSession } from './core/session.js';
import { startRouter, refreshRoute, navigate, LOGIN_PATH, HOME_PATH } from './core/router.js';
import { assetStore } from './modules/assets/asset.store.js';
import { categoryStore, locationStore } from './modules/catalogs/catalog.store.js';
import { ensureShell, destroyShell, setActiveNav, shellKey } from './modules/layout/shell.js';

const ROUTES = Object.freeze([
  { path: LOGIN_PATH, title: 'Ingresar', public: true, view: () => import('./modules/auth/login.view.js') },
  { path: HOME_PATH, title: 'Inicio', permission: 'assets.read', view: () => import('./modules/dashboard/dashboard.view.js') },
  { path: '/assets', title: 'Bienes', permission: 'assets.read', view: () => import('./modules/assets/asset-list.view.js') },
  { path: '/assets/new', title: 'Registrar bien', permission: 'assets.write', view: () => import('./modules/assets/asset-form.view.js') },
  { path: '/assets/:id', title: 'Detalle del bien', permission: 'assets.read', view: () => import('./modules/assets/asset-detail.view.js') },
  { path: '/assets/:id/edit', title: 'Editar bien', permission: 'assets.write', view: () => import('./modules/assets/asset-form.view.js') },
  { path: '/profile', title: 'Mi perfil', view: () => import('./modules/profile/profile.view.js') },
  { path: '/catalogs', title: 'Departamentos y ubicaciones', permission: 'catalogs.write', view: () => import('./modules/catalogs/catalogs.view.js') },
  { path: '/reports', title: 'Reportes', permission: 'reports.view', view: () => import('./modules/reports/reports.view.js') },
  { path: '/users', title: 'Usuarios', permission: 'users.manage', view: () => import('./modules/users/users.view.js') },
]);

const STORES = [assetStore, categoryStore, locationStore];

function profileKey() {
  return shellKey(session.profile);
}

function wireSessionToStores() {
  let lastKey = profileKey();
  session.subscribe(() => {
    const key = profileKey();
    if (key === lastKey) return;
    const wasSignedIn = Boolean(lastKey);
    lastKey = key;

    if (session.isAuthenticated) {
      STORES.forEach((store) => store.start());
      if (!wasSignedIn && location.hash.startsWith(`#${LOGIN_PATH}`)) navigate(HOME_PATH);
      else refreshRoute(); // role, name, username or photo changed: re-check permissions, rebuild the shell
    } else {
      STORES.forEach((store) => store.stop());
      destroyShell();
      navigate(LOGIN_PATH);
    }
  });
}

/** @param {HTMLElement} root */
export async function startApp(root) {
  await startSession();
  if (session.isAuthenticated) STORES.forEach((store) => store.start());
  wireSessionToStores();

  root.removeAttribute('aria-busy');
  startRouter(ROUTES, (route, path) => {
    if (route.public) {
      destroyShell();
      return root;
    }
    const main = ensureShell(root);
    setActiveNav(path);
    return main;
  });
}
