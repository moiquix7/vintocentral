/**
 * Big answer tiles (radio buttons) for one-question-per-screen forms: the whole tile is clickable,
 * at least 56 px tall, with a visible check. Native radios, so keyboard and screen readers work as usual.
 * Same wrapper as field() (data-field + .field-error), so form.js can show errors under it.
 */
import { h } from '../core/dom.js';

let groupCounter = 0;

/**
 * @param {{ name: string, label: string, options: Record<string, string>, value?: string }} spec
 * @returns {{ node: HTMLElement, value: () => string, onChange: (listener: (value: string) => void) => void }}
 */
export function choiceGroup({ name, label, options, value = '' }) {
  const id = `choice-${name}-${++groupCounter}`;
  const radios = Object.entries(options).map(([key, text]) => {
    const radio = h('input', { type: 'radio', name: id, value: key, checked: key === value });
    return { radio, tile: h('label', { class: 'choice-tile' }, radio, h('span', null, text)) };
  });
  const node = h(
    'div',
    { class: 'field field--wide', dataset: { field: name } },
    h('div', { class: 'choice-group', role: 'radiogroup', 'aria-label': label }, radios.map((r) => r.tile)),
    h('p', { class: 'field-error', hidden: true }),
  );
  return {
    node,
    value: () => radios.find((r) => r.radio.checked)?.radio.value ?? '',
    onChange: (listener) => radios.forEach((r) => r.radio.addEventListener('change', () => listener(r.radio.value))),
  };
}
