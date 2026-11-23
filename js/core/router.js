/**
 * Hash router (#/path). Works on GitHub Pages and Firebase Hosting without server rewrites.
 *
 * Route: { path: '/assets/:id', title, view: () => import(...), public?, permission? }
 * View module: export async function render(container, { params }) → optional cleanup function.
 *
 * Rules: unknown route → #/login; not signed in → #/login; missing permission → #/dashboard.
 */
import { session } from './session.js';
import { notify, handleError } from './notify.js';
import { APP } from '../config/app-config.js';

export const LOGIN_PATH = '/login';
export const HOME_PATH = '/dashboard';

let routes = [];
let resolveOutlet = () => null;
let cleanup = null;
let renderToken = 0;

export function navigate(path) {
  const target = `#${path}`;
  if (location.hash === target) render();
  else location.hash = target;
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

function currentPath() {
  const path = location.hash.replace(/^#/, '');
  return path.startsWith('/') ? path : LOGIN_PATH;
}

async function render() {
  const token = ++renderToken;
  const path = currentPath();
  const found = match(path);

  if (!found) return redirect(LOGIN_PATH);
  const { route, params } = found;
  if (!route.public && !session.isAuthenticated) return redirect(LOGIN_PATH);
  if (route.permission && !session.can(route.permission)) {
    notify.info('No tiene permiso para ver esa página.');
    return redirect(HOME_PATH);
  }

  try {
    cleanup?.();
  } catch (error) {
    handleError(error, 'view cleanup');
  }
  cleanup = null;

  try {
    const module = await route.view();
    if (token !== renderToken) return; // a newer navigation started meanwhile
    const outlet = resolveOutlet(route, path);
    const result = await module.render(outlet, { params });
    if (token !== renderToken) {
      if (typeof result === 'function') result();
      return;
    }
    cleanup = typeof result === 'function' ? result : null;
    document.title = `${route.title} · ${APP.name}`;
    outlet.querySelector('h1')?.focus({ preventScroll: false });
  } catch (error) {
    handleError(error, `render ${path}`);
  }
}

/**
 * @param {Array<object>} routeList
 * @param {(route: object, path: string) => HTMLElement} outletResolver where each view renders
 */
export function startRouter(routeList, outletResolver) {
  routes = routeList.map((route) => ({ ...route, compiled: compile(route.path) }));
  resolveOutlet = outletResolver;
  window.addEventListener('hashchange', render);
  render();
}

/** Re-evaluates the current route (e.g. after sign in / sign out). */
export function refreshRoute() {
  render();
}
