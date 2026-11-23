/**
 * Error model and Firebase error translation.
 * Every error that reaches the user goes through toAppError() so the message is friendly and in Spanish.
 */

export class AppError extends Error {
  /**
   * @param {string} userMessage message safe to show to the user
   * @param {{ code?: string, cause?: unknown }} [options]
   */
  constructor(userMessage, { code = 'app/error', cause } = {}) {
    super(userMessage);
    this.name = 'AppError';
    this.code = code;
    this.userMessage = userMessage;
    this.cause = cause;
  }
}

export class ValidationError extends AppError {
  /** @param {Record<string, string>} fields field name → message */
  constructor(fields, userMessage = 'Revise los campos marcados.') {
    super(userMessage, { code: 'app/validation' });
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

const MESSAGES = Object.freeze({
  'auth/invalid-credential': 'Usuario o contraseña incorrectos.',
  'auth/invalid-login-credentials': 'Usuario o contraseña incorrectos.',
  'auth/wrong-password': 'Usuario o contraseña incorrectos.',
  'auth/user-not-found': 'Usuario o contraseña incorrectos.',
  'auth/invalid-email': 'El correo electrónico no es válido.',
  'auth/missing-email': 'Escriba su correo electrónico.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada. Contacte al administrador.',
  'auth/too-many-requests': 'Demasiados intentos. Espere unos minutos e intente de nuevo.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
  'auth/weak-password': 'La contraseña es muy débil (mínimo 8 caracteres).',
  'auth/network-request-failed': 'Sin conexión a internet. Revise su conexión e intente de nuevo.',
  'auth/api-key-not-valid': 'La configuración de Firebase no es válida.',
  'auth/unauthorized-domain': 'Este sitio no está autorizado en Firebase (Authorized domains).',
  'permission-denied': 'No tiene permiso para realizar esta acción.',
  unauthenticated: 'Su sesión terminó. Vuelva a ingresar.',
  unavailable: 'Sin conexión con el servidor. Intente de nuevo en unos momentos.',
  'deadline-exceeded': 'El servidor tardó demasiado en responder. Intente de nuevo.',
  'not-found': 'El registro no existe o fue eliminado.',
  'resource-exhausted': 'Se alcanzó el límite de uso. Intente más tarde.',
  'storage/unauthorized': 'No tiene permiso para subir o borrar fotos.',
  'storage/object-not-found': 'La foto ya no existe.',
  'storage/quota-exceeded': 'Se alcanzó el límite de almacenamiento de fotos.',
  'storage/retry-limit-exceeded': 'No se pudo subir la foto. Revise su conexión.',
  'storage/canceled': 'La subida de la foto fue cancelada.',
});

const DEFAULT_MESSAGE = 'Ocurrió un error inesperado. Intente de nuevo.';

/** Normalises any thrown value into an AppError. Firestore codes may come with a "firestore/" prefix. */
export function toAppError(error) {
  if (error instanceof AppError) return error;
  const rawCode = typeof error?.code === 'string' ? error.code : '';
  const code = rawCode.replace(/^firestore\//, '');
  const message = MESSAGES[code] ?? DEFAULT_MESSAGE;
  return new AppError(message, { code: code || 'app/unknown', cause: error });
}

export function isNotFound(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  return code === 'storage/object-not-found' || code === 'not-found';
}
