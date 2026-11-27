/**
 * Application constants. Pure data: no DOM, no Firebase.
 * Field limits here must match firestore.rules and storage.rules.
 */

export const APP = Object.freeze({
  name: 'Vinto Central - Inventario',
  churchName: 'Iglesia Adventista del Séptimo Día',
  /** Login page heading (h1) and subtitle. */
  churchFullName: 'Iglesia Adventista del Séptimo Día Vinto - Central',
  systemName: 'Control de Inventario',
  locale: 'es-BO',
  currency: 'BOB',
  /** Single logo file used by the header, login and error screens (favicon: index.html). */
  logo: 'static/img/logo-iasd.png',
  loginBackground: 'static/img/login-bg.jpg',
});

export const ROLES = Object.freeze({
  admin: 'Administrador',
  editor: 'Editor',
  viewer: 'Consulta',
});

export const PERMISSIONS_BY_ROLE = Object.freeze({
  admin: ['assets.read', 'assets.write', 'assets.delete', 'catalogs.write', 'reports.view', 'users.manage'],
  editor: ['assets.read', 'assets.write', 'catalogs.write', 'reports.view'],
  viewer: ['assets.read', 'reports.view'],
});

/** Asset conditions, ordered from best to worst. */
export const CONDITIONS = Object.freeze({
  new: 'Nuevo',
  good: 'Bueno',
  fair: 'Regular',
  poor: 'Malo',
  out_of_service: 'Fuera de servicio',
});

/** Availability of an article, ordered from most to least usable. Missing on old articles = available. */
export const AVAILABILITY = Object.freeze({
  available: 'Disponible',
  in_use: 'En uso',
  loaned: 'Prestado',
  in_repair: 'En reparación',
  missing: 'Extraviado',
});

export const DEFAULT_AVAILABILITY = 'available';

/** Conditions that the dashboard flags as "needs attention". */
export const ATTENTION_CONDITIONS = Object.freeze(['poor', 'out_of_service']);

export const LIMITS = Object.freeze({
  asset: {
    code: 30,
    name: 120,
    description: 500,
    tags: 10,
    tagLength: 30,
    photos: 4,
    maxValue: 1_000_000_000,
    maxQuantity: 100_000,
  },
  catalog: { name: 60, description: 200, leader: 80, maxLeaders: 30, firstYear: 1950 },
  user: { email: 254, displayName: 80, minPassword: 8, maxPassword: 128, usernameMin: 3, usernameMax: 30 },
  image: { maxInputBytes: 20 * 1024 * 1024, maxSide: 1600, quality: 0.8 },
  profileImage: { maxSide: 512, quality: 0.85 },
});

export const COLLECTIONS = Object.freeze({
  assets: 'assets',
  /** UI "Departamentos" (technical name kept to avoid a data migration). */
  categories: 'categories',
  /** UI "Categorías": type of asset (furniture, equipment, vehicles…). */
  assetTypes: 'assetTypes',
  locations: 'locations',
  users: 'users',
  usernames: 'usernames',
});

/** Username format (must match validUsername() in firestore.rules). */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;
