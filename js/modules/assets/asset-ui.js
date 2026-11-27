/** Small presentational pieces shared by the asset views (and the inventory grid). */
import { h, icon } from '../../core/dom.js';
import { AVAILABILITY, CONDITIONS } from '../../config/app-config.js';
import { availabilityOf } from './asset.model.js';

export function conditionBadge(condition) {
  return h('span', { class: `badge badge--${condition}` }, CONDITIONS[condition] ?? '—');
}

export function availabilityBadge(asset) {
  const availability = availabilityOf(asset);
  return h('span', { class: `badge badge--${availability}` }, AVAILABILITY[availability]);
}

export function thumbnail(asset, size = 56) {
  const photo = asset.photos?.[0];
  if (!photo?.url) return h('span', { class: 'thumb thumb--empty', 'aria-hidden': 'true' }, icon('image'));
  return h('img', { class: 'thumb', src: photo.url, alt: '', width: String(size), height: String(size), loading: 'lazy' });
}
