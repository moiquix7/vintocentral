/** User avatar: profile photo, or initials on a soft colored circle when there is none. */
import { h } from '../core/dom.js';

export function initials(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

/**
 * @param {{ displayName?: string, photoUrl?: string }} person
 * @param {{ size?: number, src?: string }} [options] src overrides photoUrl (e.g. a local preview)
 */
export function avatar(person, { size = 40, src } = {}) {
  const url = src ?? person?.photoUrl;
  const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px`;
  if (url) return h('img', { class: 'avatar', src: url, alt: '', width: String(size), height: String(size), style });
  return h('span', { class: 'avatar avatar--initials', style, 'aria-hidden': 'true' }, initials(person?.displayName));
}
