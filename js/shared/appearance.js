/**
 * Appearance controls (theme, soft color palette, focus mode and text size).
 * Reused by the user menu and Mi perfil; every instance stays in sync through
 * preferences.subscribePreferences().
 */
import { h } from '../core/dom.js';
import {
  THEMES,
  PALETTES,
  FONT_SCALES,
  getPreferences,
  updatePreferences,
  subscribePreferences,
} from '../core/preferences.js';

let groupCounter = 0;

function radioGroup({ legend, name, options, value, className, renderLabel, onChange }) {
  const inputs = [];
  const group = h(
    'fieldset',
    { class: `choice-group ${className}` },
    h('legend', null, legend),
    Object.entries(options).map(([key, label]) => {
      const radio = h('input', { type: 'radio', name, value: key, checked: key === value, class: 'choice-input' });
      radio.addEventListener('change', () => radio.checked && onChange(key));
      inputs.push(radio);
      return h('label', { class: 'choice', title: label }, radio, renderLabel(key, label));
    }),
  );
  return {
    node: group,
    set(next) {
      inputs.forEach((input) => (input.checked = input.value === next));
    },
  };
}

/** @returns {{ node: HTMLElement, dispose: () => void }} */
export function appearanceControls() {
  const id = ++groupCounter;
  const prefs = getPreferences();

  const theme = radioGroup({
    legend: 'Tema',
    name: `theme-${id}`,
    options: THEMES,
    value: prefs.theme,
    className: 'choice-group--segmented',
    renderLabel: (_, label) => h('span', { class: 'choice-text' }, label),
    onChange: (value) => updatePreferences({ theme: value }),
  });

  const palette = radioGroup({
    legend: 'Colores',
    name: `palette-${id}`,
    options: PALETTES,
    value: prefs.palette,
    className: 'choice-group--swatches',
    renderLabel: (key, label) => [
      h('span', { class: 'swatch', dataset: { swatch: key }, 'aria-hidden': 'true' }),
      h('span', { class: 'visually-hidden' }, label),
    ],
    onChange: (value) => updatePreferences({ palette: value }),
  });

  const focus = h('input', { type: 'checkbox', class: 'switch', id: `focus-${id}`, checked: prefs.focusMode });
  focus.addEventListener('change', () => updatePreferences({ focusMode: focus.checked }));

  const scale = h(
    'select',
    { id: `scale-${id}` },
    Object.entries(FONT_SCALES).map(([value, label]) => h('option', { value, selected: value === prefs.fontScale }, label)),
  );
  scale.addEventListener('change', () => updatePreferences({ fontScale: scale.value }));

  const dispose = subscribePreferences((next) => {
    theme.set(next.theme);
    palette.set(next.palette);
    focus.checked = next.focusMode;
    scale.value = next.fontScale;
  });

  return {
    node: h(
      'div',
      { class: 'appearance' },
      theme.node,
      palette.node,
      h(
        'div',
        { class: 'pref-row' },
        h('label', { class: 'switch-label', for: `focus-${id}` }, focus, 'Modo enfoque'),
        h('p', { class: 'hint' }, 'Más espacio, sin animaciones, una columna.'),
      ),
      h('div', { class: 'pref-row' }, h('label', { for: `scale-${id}` }, 'Tamaño de letra'), scale),
    ),
    dispose,
  };
}
