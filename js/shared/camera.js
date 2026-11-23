/**
 * Takes a photo with the device camera (getUserMedia) inside a modal.
 * Resolves with a JPEG Blob, or null if the user cancels.
 * Requires HTTPS (GitHub Pages / Firebase Hosting) or localhost.
 */
import { h, icon } from '../core/dom.js';
import { AppError } from '../core/errors.js';
import { openModal } from './dialog.js';
import { canvasToJpeg } from './image.js';

export function isCameraSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;
}

const CAMERA_ERRORS = Object.freeze({
  NotAllowedError: 'Permiso de cámara denegado. Habilítelo en la configuración del navegador.',
  NotFoundError: 'No se encontró una cámara en este dispositivo.',
  NotReadableError: 'La cámara está siendo usada por otra aplicación.',
  OverconstrainedError: 'La cámara no es compatible.',
});

async function requestStream() {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
  } catch (cause) {
    const message = CAMERA_ERRORS[cause?.name] ?? 'No se pudo abrir la cámara.';
    throw new AppError(message, { code: 'app/camera', cause });
  }
}

export async function takePhoto() {
  if (!isCameraSupported()) {
    throw new AppError('La cámara no está disponible en este navegador. Use "Elegir foto".', { code: 'app/camera' });
  }
  const stream = await requestStream();
  const video = h('video', { class: 'camera-video', autoplay: true, playsinline: true, muted: true });
  video.srcObject = stream;

  try {
    const blob = await openModal((close) => ({
      title: 'Tomar foto',
      body: video,
      actions: [
        h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => close(null) }, 'Cancelar'),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-primary',
            onclick: async () => {
              if (!video.videoWidth) return; // camera not ready yet
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              canvas.getContext('2d')?.drawImage(video, 0, 0);
              try {
                close(await canvasToJpeg(canvas, 0.92));
              } catch {
                close(null);
              }
            },
          },
          icon('camera'),
          'Capturar',
        ),
      ],
    }));
    return blob instanceof Blob ? blob : null;
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}
