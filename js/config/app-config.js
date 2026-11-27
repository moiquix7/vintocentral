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
  /**
   * System administrator shown on the login page ("¿No tiene cuenta?").
   * email / phone are optional: an empty value is not shown. Phone in international format, e.g. '+591 70000000'.
   */
  adminContact: Object.freeze({
    name: 'Luz Andrea Guachalla',
    role: 'Secretaria de la iglesia · Administradora del sistema',
    email: '',
    phone: '',
  }),
});

export const ROLES = Object.freeze({
  admin: 'Administrador',
  editor: 'Editor',
  viewer: 'Consulta',
});

export const PERMISSIONS_BY_ROLE = Object.freeze({
  admin: ['dashboard.view', 'assets.read', 'assets.write', 'assets.delete', 'catalogs.write', 'catalogs.delete', 'reports.view', 'history.view', 'users.manage'],
  editor: ['dashboard.view', 'assets.read', 'assets.write', 'catalogs.write', 'reports.view', 'history.view'],
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

/** Availability values that mean "not available": only these keep a reason (unavailableReason). */
export const UNAVAILABLE = Object.freeze(['loaned', 'in_repair', 'missing']);

/** The dashboard flags an article as "needs attention" when its condition or availability is one of these. */
export const ATTENTION_CONDITIONS = Object.freeze(['poor', 'out_of_service']);
export const ATTENTION_AVAILABILITY = Object.freeze(['in_repair', 'missing']);

/** Connected users: heartbeat interval and how recent the last one must be to count as connected. */
export const PRESENCE = Object.freeze({ heartbeatMs: 2 * 60 * 1000, onlineWindowMs: 5 * 60 * 1000 });

export const LIMITS = Object.freeze({
  asset: {
    code: 30,
    name: 120,
    description: 500,
    brand: 60,
    model: 60,
    serialNumber: 60,
    unavailableReason: 200,
    notes: 500,
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
  /** Change history: changes per entry, length of each described value, entries per page. */
  history: { changes: 20, text: 200, pageSize: 100 },
});

export const COLLECTIONS = Object.freeze({
  assets: 'assets',
  /** UI "Departamentos" (technical name kept to avoid a data migration). */
  categories: 'categories',
  /** UI "Tipos de artículo": type of asset (furniture, equipment, vehicles…). */
  assetTypes: 'assetTypes',
  locations: 'locations',
  users: 'users',
  usernames: 'usernames',
  presence: 'presence',
  assetHistory: 'assetHistory',
});

/** Username format (must match validUsername() in firestore.rules). */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;
