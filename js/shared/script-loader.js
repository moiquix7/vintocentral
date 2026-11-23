/** Loads a classic (UMD) script once, on demand. */
import { AppError } from '../core/errors.js';

const loaded = new Map();

export function loadScript(src) {
  if (!loaded.has(src)) {
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.referrerPolicy = 'no-referrer';
      script.onload = () => resolve();
      script.onerror = () => {
        loaded.delete(src);
        script.remove();
        reject(new AppError('No se pudo descargar un componente necesario. Revise su conexión.', { code: 'app/script' }));
      };
      document.head.appendChild(script);
    });
    loaded.set(src, promise);
  }
  return loaded.get(src);
}
