/**
 * Browser-side image compression: every photo is resized (max side 1600 px) and re-encoded
 * as JPEG before upload, so Storage never receives oversized files.
 */
import { LIMITS } from '../config/app-config.js';
import { AppError } from '../core/errors.js';

const ACCEPTED = /^image\/(jpeg|png|webp|gif|heic|heif)$/;

/**
 * @param {Blob} file
 * @param {{ maxSide: number, quality: number }} [options] defaults to asset photos (LIMITS.image)
 * @returns {Promise<Blob>} JPEG blob
 */
export async function compressImage(file, { maxSide, quality } = LIMITS.image) {
  if (!(file instanceof Blob) || !ACCEPTED.test(file.type)) {
    throw new AppError('El archivo no es una imagen válida (use JPG, PNG o WEBP).', { code: 'app/image-type' });
  }
  if (file.size > LIMITS.image.maxInputBytes) {
    throw new AppError('La imagen es demasiado grande (máximo 20 MB).', { code: 'app/image-size' });
  }

  const source = await decode(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(source.width * scale);
    canvas.height = Math.round(source.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new AppError('Su navegador no puede procesar imágenes.');
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return await canvasToJpeg(canvas, quality);
  } finally {
    source.close?.();
  }
}

/** Decodes honouring EXIF orientation (modern browsers do this by default). */
async function decode(file) {
  try {
    if ('createImageBitmap' in window) return await createImageBitmap(file);
    return await loadImageElement(file);
  } catch (cause) {
    throw new AppError('No se pudo leer la imagen. Pruebe con otra foto.', { code: 'app/image-decode', cause });
  }
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    image.src = url;
  });
}

export function canvasToJpeg(canvas, quality = LIMITS.image.quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new AppError('No se pudo procesar la imagen.'))),
      'image/jpeg',
      quality,
    );
  });
}
