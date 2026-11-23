/** Small presentational pieces shared by the asset views. */
import { h, icon } from '../../core/dom.js';
import { CONDITIONS } from '../../config/app-config.js';

export function conditionBadge(condition) {
  return h('span', { class: `badge badge--${condition}` }, CONDITIONS[condition] ?? '—');
}

export function thumbnail(asset, size = 56) {
  const photo = asset.photos?.[0];
  if (!photo?.url) return h('span', { class: 'thumb thumb--empty', 'aria-hidden': 'true' }, icon('image'));
  return h('img', { class: 'thumb', src: photo.url, alt: '', width: String(size), height: String(size), loading: 'lazy' });
}
