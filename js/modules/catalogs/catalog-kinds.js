/**
 * The three kinds of "Registros", defined once: the hub buttons, the routes `#/records/:kind`
 * and the list pages all read from here. Order = order of the hub buttons.
 */
import { assetTypeStore, categoryStore, locationStore } from './catalog.store.js';
import { assetTypeService, categoryService, locationService } from './catalog.service.js';

export const RECORDS_PATH = '/records';

export const CATALOG_KINDS = Object.freeze({
  'asset-types': Object.freeze({
    label: 'Tipo de artículo',
    title: 'Tipos de artículo',
    noun: 'tipo de artículo',
    added: 'Tipo de artículo agregado.',
    intro: 'Qué clase de artículo es. Ej.: Mobiliario, Equipo de sonido, Vehículos.',
    icon: 'tag',
    store: assetTypeStore,
    service: assetTypeService,
    withLeader: false,
  }),
  departments: Object.freeze({
    label: 'Departamento',
    title: 'Departamentos',
    noun: 'departamento',
    added: 'Departamento agregado.',
    intro: 'Ministerio responsable del artículo, con su historial de líderes. Ej.: Jóvenes, Escuela Sabática, Música.',
    icon: 'users',
    store: categoryStore,
    service: categoryService,
    withLeader: true,
  }),
  locations: Object.freeze({
    label: 'Ubicación',
    title: 'Ubicaciones',
    noun: 'ubicación',
    added: 'Ubicación agregada.',
    intro: 'Dónde está el artículo. Ej.: Templo, Salón de jóvenes.',
    icon: 'pin',
    store: locationStore,
    service: locationService,
    withLeader: false,
  }),
});

/** @returns {object|null} the kind for a route slug, or null when the slug is unknown. */
export function catalogKind(slug) {
  return Object.hasOwn(CATALOG_KINDS, slug) ? { slug, ...CATALOG_KINDS[slug] } : null;
}

export function recordsPath(slug) {
  return `${RECORDS_PATH}/${slug}`;
}
