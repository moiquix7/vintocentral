/**
 * Hash router (#/path). Works on GitHub Pages and Firebase Hosting without server rewrites.
 *
 * Route: { path: '/assets/:id', title, view: () => import(...), public?, permission? }
 * View module: export async function render(container, { params }) → optional cleanup function.
 *
 * Rules: unknown route → #/login; not signed in → #/login; missing permission → home page.
 * The home page depends on the role, so the app gives the router a `home()` resolver.
 */
import { session } from './session.js';
import { notify, handleError } from './notify.js';
import { APP } from '../config/app-config.js';

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
    const target = home();
    return redirect(target === path ? LOGIN_PATH : target); // never loop on the same page
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
