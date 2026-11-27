/**
 * "Registros" hub (admin and editor): three large buttons, one per kind of record
 * (tipo de artículo, departamento, ubicación), each leading to its own list page.
 */
import { h, icon, mount, pageHeader } from '../../core/dom.js';
import { formatNumber } from '../../shared/format.js';
import { CATALOG_STORES, catalogsReady } from './catalog.store.js';
import { CATALOG_KINDS, recordsPath } from './catalog-kinds.js';

function countText(count) {
  if (count === 0) return 'Sin registros todavía';
  return count === 1 ? '1 registro' : `${formatNumber(count)} registros`;
}

export async function render(container) {
  await catalogsReady();
  const list = h('ul', { class: 'record-hub', 'aria-label': 'Tipos de registro' });

  function draw() {
    mount(
      list,
      Object.entries(CATALOG_KINDS).map(([slug, kind]) =>
        h(
          'li',
          null,
          h(
            'a',
            { href: `#${recordsPath(slug)}`, class: 'record-tile' },
            icon(kind.icon),
            h('strong', { class: 'record-tile-title' }, kind.label),
            h('span', { class: 'record-tile-hint' }, kind.intro),
            h('span', { class: 'record-tile-count' }, countText(kind.store.getAll().length)),
          ),
        ),
      ),
    );
  }

  mount(
    container,
    pageHeader('Registros'),
    h('p', { class: 'muted' }, 'Elija qué desea ver o administrar. Cada artículo tiene un tipo de artículo, un departamento responsable y una ubicación.'),
    list,
  );
  draw();
  const unsubscribers = CATALOG_STORES.map((store) => store.subscribe(draw));
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
