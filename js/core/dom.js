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
  tag: 'M3 12V3h9l9 9-9 9-9-9zM7.5 7.5h.01',
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
