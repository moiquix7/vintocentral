/**
 * Minimal DOM builder. User data is always inserted as text nodes (never innerHTML),
 * which prevents HTML/script injection.
 */

/**
 * @param {string} tag
 * @param {Record<string, unknown>|null} [props] attributes; `class`, `dataset`, `onX` handlers are special
 * @param {...unknown} children strings, numbers, nodes, arrays, or null/false (skipped)
 */
export function h(tag, props = null, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') element.className = String(value);
    else if (key === 'dataset') Object.assign(element.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'value') element.value = String(value);
    else element.setAttribute(key, value === true ? '' : String(value));
  }
  append(element, children);
  return element;
}

function append(parent, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }
}

/** Replaces all content of `container`. */
export function mount(container, ...nodes) {
  container.replaceChildren();
  append(container, nodes);
}

/** Inline SVG icon from a small fixed set (decorative: hidden from screen readers). */
const ICON_PATHS = Object.freeze({
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  box: 'M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7M12 11v10',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5',
  dollar: 'M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  tag: 'M3 12V3h9l9 9-9 9-9-9zM7.5 7.5h.01',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  file: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8',
  users: 'M16 21v-2a4 4 0 00-8 0v2M12 11a4 4 0 100-8 4 4 0 000 8zM20 21v-2a4 4 0 00-3-3.9M4 21v-2a4 4 0 013-3.9',
  plus: 'M12 5v14M5 12h14',
  camera: 'M3 8h4l2-3h6l2 3h4v12H3zM12 17a4 4 0 100-8 4 4 0 000 8z',
  image: 'M3 4h18v16H3zM3 16l5-5 5 5 3-3 5 5M15 9h.01',
  edit: 'M4 20h4L19 9l-4-4L4 16v4z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  logout: 'M15 4h4v16h-4M10 17l5-5-5-5M15 12H3',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  back: 'M15 18l-6-6 6-6',
  key: 'M14 10a4 4 0 10-4 4M10 14l-7 7M6 18l2 2',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4M12 15v2',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4M6.6 6.6A17 17 0 002 12s3.5 7 10 7a10 10 0 005.4-1.6M9.9 9.9a3 3 0 004.2 4.2',
  chevron: 'M6 9l6 6 6-6',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  check: 'M9 11l3 3 8-8M20 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  sun: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3',
  phone: 'M5 3h4l2 5-3 2a12 12 0 006 6l2-3 5 2v4a2 2 0 01-2 2A18 18 0 013 5a2 2 0 012-2z',
  chat: 'M21 12a8 8 0 01-11.6 7.1L4 21l1.9-5.4A8 8 0 1121 12z',
  alert: 'M12 3l10 18H2zM12 10v4M12 17h.01',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  online: 'M12 13a1 1 0 100-2 1 1 0 000 2zM8.5 8.5a5 5 0 000 7M15.5 8.5a5 5 0 010 7M5.6 5.6a9 9 0 000 12.8M18.4 5.6a9 9 0 010 12.8',
});

export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icon');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICON_PATHS[name] ?? '');
  svg.appendChild(path);
  return svg;
}

/** Standard page header used by every view: focusable h1 + optional actions. */
export function pageHeader(title, ...actions) {
  return h(
    'header',
    { class: 'page-header' },
    h('h1', { tabindex: '-1' }, title),
    actions.length ? h('div', { class: 'page-actions' }, actions) : null,
  );
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgElement(tag, attributes) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

/**
 * Animated inventory box: the lid bobs while a scan line sweeps the barcode label.
 * Decorative (aria-hidden); the text next to it says what is happening. Keep in sync with the static
 * copy in index.html (boot screen). Styles: .inv-loader in css/components.css.
 */
function inventoryLoaderArt() {
  const svg = svgElement('svg', { class: 'inv-loader-art', viewBox: '0 0 48 48', 'aria-hidden': 'true', focusable: 'false' });
  svg.append(
    svgElement('path', { class: 'inv-box', d: 'M9 19h30v20a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3z' }),
    svgElement('path', { class: 'inv-lid', d: 'M7 12h34v7H7z' }),
    svgElement('path', { class: 'inv-code', d: 'M17 26v9M20 26v9M24 26v9M27 26v9M31 26v9' }),
    svgElement('path', { class: 'inv-scan', d: 'M14 26h20' }),
  );
  return svg;
}

/**
 * Loading indicator with text. `large` for pages (announced as a status), `small` inside buttons and
 * messages (the surrounding element announces it).
 * @param {{ label?: string, size?: 'large' | 'small' }} [options]
 */
export function inventoryLoader({ label = 'Cargando…', size = 'large' } = {}) {
  const large = size === 'large';
  return h(
    large ? 'div' : 'span',
    { class: `inv-loader inv-loader--${large ? 'large' : 'small'}`, role: large ? 'status' : null },
    inventoryLoaderArt(),
    h('span', { class: 'inv-loader-text' }, label),
  );
}
