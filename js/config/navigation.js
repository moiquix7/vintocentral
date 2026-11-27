/**
 * Application sections shown in the navigation and as dashboard shortcuts. Pure data.
 * `permission` must be one of PERMISSIONS_BY_ROLE (app-config.js); `icon` a name from core/dom.js.
 */
export const NAV_ITEMS = Object.freeze([
  { path: '/home', label: 'Inicio', icon: 'home', permission: 'assets.read', hint: 'Resumen y últimos movimientos' },
  { path: '/dashboard', label: 'Tablero', icon: 'chart', permission: 'dashboard.view', hint: 'Indicadores y gráficos del inventario' },
  { path: '/assets', label: 'Artículos', icon: 'box', permission: 'assets.read', hint: 'Buscar, filtrar y ordenar artículos' },
  { path: '/inventory', label: 'Toma de inventario', icon: 'check', permission: 'assets.write', hint: 'Verificar artículos en una tabla' },
  { path: '/records', label: 'Registros', icon: 'tag', permission: 'catalogs.write', hint: 'Tipos de artículo, departamentos y ubicaciones' },
  { path: '/reports', label: 'Reportes', icon: 'file', permission: 'reports.view', hint: 'Reporte PDF del inventario' },
  { path: '/history', label: 'Historial', icon: 'clock', permission: 'history.view', hint: 'Quién cambió qué y cuándo' },
  { path: '/users', label: 'Usuarios', icon: 'users', permission: 'users.manage', hint: 'Cuentas, roles y acceso' },
]);
