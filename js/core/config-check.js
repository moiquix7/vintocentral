/** Pure check: are all Firebase web config values filled in (no placeholders)? */

export const REQUIRED_FIREBASE_KEYS = Object.freeze([
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
]);

export function isFirebaseConfigured(config) {
  if (!config || typeof config !== 'object') return false;
  return REQUIRED_FIREBASE_KEYS.every((key) => {
    const value = config[key];
    return typeof value === 'string' && value.trim() !== '' && !value.startsWith('REPLACE_');
  });
}
