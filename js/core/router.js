/**
 * Hash router (#/path). Works on GitHub Pages and Firebase Hosting without server rewrites.
 *
 * Route: { path: '/assets/:id', title, view: () => import(...), public?, permission? }
 * View module: export async function render(container, { params, query }) → optional cleanup function.
 * `query` is the part after "?" (e.g. #/assets?filtro=atencion) as URLSearchParams; it never affects matching.
 *
 * Rules: unknown route → #/login; not signed in → #/login; missing permission → home page.
 * The home page depends on the role, so the app gives the router a `home()` resolver.
 */
import { session } from './session.js';
import { notify, handleError } from './notify.js';
import { APP } from '../config/app-config.js';
import { inventoryLoader, mount } from './dom.js';

/** A page that takes longer than this to appear shows the loading indicator meanwhile. */
const SLOW_RENDER_MS = 250;

export const LOGIN_PATH = '/login';

let routes = [];
let home = () => LOGIN_PATH;
let resolveOutlet = () => null;
let cleanup = null;
let renderToken = 0;

export function navigate(path) {
  const target = `#${path}`;
  if (location.hash === target) render();
  else location.hash = target;
}

/** Goes to the signed-in user's home page (depends on the role). */
export function navigateHome() {
  navigate(home());
}

function redirect(path) {
  history.replaceState(null, '', `#${path}`);
  render();
}

function compile(path) {
  const names = [];
  const pattern = path.replace(/:([a-zA-Z]+)/g, (_, name) => {
    names.push(name);
    return '([^/]+)';
  });
  return { regex: new RegExp(`^${pattern}$`), names };
}

function match(path) {
  for (const route of routes) {
    const result = route.compiled.regex.exec(path);
    if (result) {
      const params = Object.fromEntries(route.compiled.names.map((name, i) => [name, decodeURIComponent(result[i + 1])]));
      return { route, params };
    }
  }
  return null;
}

/** Current hash split into the path (used for matching) and its query string. */
function currentLocation() {
  const [rawPath, search = ''] = location.hash.replace(/^#/, '').split('?');
  return { path: rawPath.startsWith('/') ? rawPath : LOGIN_PATH, query: new URLSearchParams(search) };
}

async function render() {
  const token = ++renderToken;
  const { path, query } = currentLocation();
  const found = match(path);

  if (!found) return redirect(LOGIN_PATH);
  const { route, params } = found;
  if (!route.public && !session.isAuthenticated) return redirect(LOGIN_PATH);
  if (route.permission && !session.can(route.permission)) {
    notify.info('No tiene permiso para ver esa página.');
    const target = home();
    return redirect(target === path ? LOGIN_PATH : target); // never loop on the same page
  }

  try {
    cleanup?.();
  } catch (error) {
    handleError(error, 'view cleanup');
  }
  cleanup = null;

  // Waiting for data (stores, Firestore) or for the view's code: show the loader if it takes a while.
  let outlet = null;
  const slowTimer = setTimeout(() => {
    if (token === renderToken && outlet) mount(outlet, inventoryLoader({ label: 'Cargando…' }));
  }, SLOW_RENDER_MS);
  try {
    outlet = resolveOutlet(route, path);
    const module = await route.view();
    if (token !== renderToken) return; // a newer navigation started meanwhile
    const result = await module.render(outlet, { params, query });
    clearTimeout(slowTimer);
    if (token !== renderToken) {
      if (typeof result === 'function') result();
      return;
    }
    cleanup = typeof result === 'function' ? result : null;
    document.title = `${route.title} · ${APP.name}`;
    outlet.querySelector('h1')?.focus({ preventScroll: false });
  } catch (error) {
    handleError(error, `render ${path}`);
  } finally {
    clearTimeout(slowTimer);
  }
}

/**
 * @param {Array<object>} routeList
 * @param {(route: object, path: string) => HTMLElement} outletResolver where each view renders
 * @param {() => string} homeResolver home path of the current user
 */
export function startRouter(routeList, outletResolver, homeResolver) {
  routes = routeList.map((route) => ({ ...route, compiled: compile(route.path) }));
  resolveOutlet = outletResolver;
  home = homeResolver;
  window.addEventListener('hashchange', render);
  render();
}

/** Re-evaluates the current route (e.g. after sign in / sign out). */
export function refreshRoute() {
  render();
}
