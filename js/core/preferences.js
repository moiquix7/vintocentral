/**
 * Per-browser appearance preferences: theme, color palette, focus mode (ADHD-friendly), text size.
 * Applied as data attributes on <html>; CSS tokens do the rest.
 *
 * index.html has a tiny inline script that applies the same attributes before the first paint;
 * it uses the same STORAGE_KEY and value names as this module — keep them in sync.
 * Storage failures (private mode, blocked storage) are ignored: defaults are used.
 */

const STORAGE_KEY = 'vintocentral.preferences';

export const THEMES = Object.freeze({ system: 'Según el dispositivo', light: 'Claro', dark: 'Oscuro' });
export const PALETTES = Object.freeze({
  teal: 'Verde azulado',
  sage: 'Salvia',
  lavender: 'Lavanda',
  terracotta: 'Terracota',
  sky: 'Cielo',
});
export const FONT_SCALES = Object.freeze({ normal: 'Normal', large: 'Grande', xlarge: 'Muy grande' });

const DEFAULTS = Object.freeze({ theme: 'system', palette: 'teal', focusMode: false, fontScale: 'normal' });

const darkQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
const listeners = new Set();
let current = load();

function pick(options, value, fallback) {
  return Object.hasOwn(options, value) ? value : fallback;
}

function load() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return {
      theme: pick(THEMES, stored.theme, DEFAULTS.theme),
      palette: pick(PALETTES, stored.palette, DEFAULTS.palette),
      focusMode: stored.focusMode === true,
      fontScale: pick(FONT_SCALES, stored.fontScale, DEFAULTS.fontScale),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable: keep in memory only */
  }
}

/** The theme actually shown ('light' | 'dark'), resolving "system" with the device setting. */
export function resolvedTheme() {
  if (current.theme !== 'system') return current.theme;
  return darkQuery?.matches ? 'dark' : 'light';
}

export function applyPreferences() {
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme();
  root.dataset.palette = current.palette;
  root.dataset.focusMode = current.focusMode ? 'on' : 'off';
  root.dataset.fontScale = current.fontScale;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    getComputedStyle(root).getPropertyValue('--primary').trim() || '#2f6f7e',
  );
}

// Follow the device when the theme is "system".
darkQuery?.addEventListener?.('change', () => {
  if (current.theme !== 'system') return;
  applyPreferences();
  listeners.forEach((listener) => listener(getPreferences())); // e.g. the header sun/moon button
});

export function getPreferences() {
  return { ...current };
}

/** Updates one or more preferences, saves, applies and notifies (so every control stays in sync). */
export function updatePreferences(patch) {
  current = {
    theme: pick(THEMES, patch.theme ?? current.theme, current.theme),
    palette: pick(PALETTES, patch.palette ?? current.palette, current.palette),
    focusMode: typeof patch.focusMode === 'boolean' ? patch.focusMode : current.focusMode,
    fontScale: pick(FONT_SCALES, patch.fontScale ?? current.fontScale, current.fontScale),
  };
  save();
  applyPreferences();
  listeners.forEach((listener) => listener(getPreferences()));
}

/** @returns {() => void} unsubscribe */
export function subscribePreferences(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
