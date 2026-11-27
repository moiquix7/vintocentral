/**
 * Application composition: routes, session → stores wiring, and where each view renders.
 * Loaded by main.js only after the Firebase configuration has been checked.
 */
import { session, startSession } from './core/session.js';
import { startRouter, refreshRoute, navigate, navigateHome, LOGIN_PATH } from './core/router.js';
import { assetStore } from './modules/assets/asset.store.js';
import { CATALOG_STORES } from './modules/catalogs/catalog.store.js';
import { ensureShell, destroyShell, setActiveNav, shellKey } from './modules/layout/shell.js';
import { startPresence, stopPresence } from './modules/presence/presence.service.js';

const HOME_PAGE_PATH = '/home';
const DASHBOARD_PATH = '/dashboard';
const ASSETS_PATH = '/assets';

const ROUTES = Object.freeze([
  { path: LOGIN_PATH, title: 'Ingresar', public: true, view: () => import('./modules/auth/login.view.js') },
  { path: HOME_PAGE_PATH, title: 'Inicio', permission: 'assets.read', view: () => import('./modules/home/home.view.js') },
  { path: DASHBOARD_PATH, title: 'Tablero', permission: 'dashboard.view', view: () => import('./modules/dashboard/dashboard.view.js') },
  { path: ASSETS_PATH, title: 'Artículos', permission: 'assets.read', view: () => import('./modules/assets/asset-list.view.js') },
  { path: '/assets/new', title: 'Registrar artículo', permission: 'assets.write', view: () => import('./modules/assets/asset-form.view.js') },
  { path: '/assets/:id', title: 'Detalle del artículo', permission: 'assets.read', view: () => import('./modules/assets/asset-detail.view.js') },
  { path: '/assets/:id/edit', title: 'Editar artículo', permission: 'assets.write', view: () => import('./modules/assets/asset-form.view.js') },
  { path: '/inventory', title: 'Toma de inventario', permission: 'assets.write', view: () => import('./modules/inventory/inventory.view.js') },
  { path: '/profile', title: 'Mi perfil', view: () => import('./modules/profile/profile.view.js') },
  { path: '/catalogs', title: 'Catálogos', permission: 'catalogs.write', view: () => import('./modules/catalogs/catalogs.view.js') },
  { path: '/reports', title: 'Reportes', permission: 'reports.view', view: () => import('./modules/reports/reports.view.js') },
  { path: '/history', title: 'Historial', permission: 'history.view', view: () => import('./modules/history/history.view.js') },
  { path: '/users', title: 'Usuarios', permission: 'users.manage', view: () => import('./modules/users/users.view.js') },
]);

const STORES = [assetStore, ...CATALOG_STORES];

/** Landing page by role: the dashboard (admin, editor) or the home page (viewer). */
function homePath() {
  if (!session.isAuthenticated) return LOGIN_PATH;
  return session.can('dashboard.view') ? DASHBOARD_PATH : HOME_PAGE_PATH;
}

function startUserServices() {
  STORES.forEach((store) => store.start());
  startPresence();
}

function stopUserServices() {
  stopPresence();
  STORES.forEach((store) => store.stop());
}

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
      startUserServices();
      if (!wasSignedIn && location.hash.startsWith(`#${LOGIN_PATH}`)) navigateHome();
      else refreshRoute(); // role, name, username or photo changed: re-check permissions, rebuild the shell
    } else {
      stopUserServices();
      destroyShell();
      navigate(LOGIN_PATH);
    }
  });
}

/** @param {HTMLElement} root */
export async function startApp(root) {
  await startSession();
  if (session.isAuthenticated) startUserServices();
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
  }, homePath);
}
