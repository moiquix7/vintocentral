/**
 * Full-screen photo viewer built on the native <dialog> (focus trap, Escape to close, top layer).
 * No domain knowledge: the caller passes the images and, optionally, how to delete one.
 * Controls: Anterior / Siguiente (also ← / →), Pantalla completa (where supported), Descargar,
 * Eliminar (only with `onDelete`) and Cerrar.
 */
import { h, icon, inventoryLoader } from '../core/dom.js';
import { notify, handleError } from '../core/notify.js';
import { confirmDialog } from './dialog.js';
import { downloadUrl } from './download.js';

/**
 * @param {{
 *   images: Array<{ url: string, alt: string, fileName: string }>,
 *   start?: number,
 *   onDelete?: (image: { url: string, alt: string, fileName: string }) => Promise<void>,
 * }} options  onDelete throws on failure; the viewer shows the error and keeps the photo.
 */
export function openLightbox({ images, start = 0, onDelete }) {
  const items = [...images];
  if (!items.length) return;
  let index = Math.min(Math.max(start, 0), items.length - 1);
  let busy = false;

  const picture = h('img', { class: 'lightbox-image', alt: '' });
  const counter = h('p', { class: 'lightbox-counter', 'aria-live': 'polite' });
  const button = (iconName, text, className = 'btn btn-secondary') =>
    h('button', { type: 'button', class: `${className} lightbox-button` }, icon(iconName), h('span', null, text));

  const previous = h('button', { type: 'button', class: 'lightbox-nav lightbox-nav--prev', 'aria-label': 'Foto anterior' }, icon('back'));
  const next = h('button', { type: 'button', class: 'lightbox-nav lightbox-nav--next', 'aria-label': 'Foto siguiente' }, icon('back'));
  const fullscreen = document.fullscreenEnabled ? button('expand', 'Pantalla completa') : null;
  const download = button('download', 'Descargar');
  const remove = onDelete ? button('trash', 'Eliminar foto', 'btn btn-danger') : null;
  const close = button('close', 'Cerrar', 'btn btn-primary');

  const dialog = h(
    'dialog',
    { class: 'lightbox', 'aria-label': 'Visor de fotos' },
    h('div', { class: 'lightbox-bar' }, counter, h('div', { class: 'lightbox-actions' }, fullscreen, download, remove, close)),
    h('div', { class: 'lightbox-stage' }, previous, picture, next),
  );

  function draw() {
    const image = items[index];
    picture.src = image.url;
    picture.alt = image.alt;
    counter.textContent = `Foto ${index + 1} de ${items.length}`;
    const single = items.length < 2;
    previous.hidden = single;
    next.hidden = single;
  }

  const go = (step) => {
    if (busy || items.length < 2) return;
    index = (index + step + items.length) % items.length;
    draw();
  };

  previous.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') go(-1);
    else if (event.key === 'ArrowRight') go(1);
  });
  close.addEventListener('click', () => dialog.close());

  fullscreen?.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await dialog.requestFullscreen();
    } catch (error) {
      console.warn('[VintoCentral] fullscreen not available', error);
    }
  });

  download.addEventListener('click', async () => {
    const image = items[index];
    download.disabled = true;
    try {
      const outcome = await downloadUrl(image.url, image.fileName);
      if (outcome === 'opened') notify.info('La foto se abrió en una pestaña nueva: guárdela desde allí.');
    } finally {
      download.disabled = false;
    }
  });

  remove?.addEventListener('click', async () => {
    const image = items[index];
    const confirmed = await confirmDialog({
      title: 'Eliminar foto',
      message: `¿Eliminar la foto ${index + 1} de ${items.length}? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;
    const original = [...remove.childNodes];
    busy = true;
    remove.disabled = true;
    remove.replaceChildren(inventoryLoader({ label: 'Eliminando…', size: 'small' }));
    try {
      await onDelete(image);
      notify.success('Foto eliminada.');
      items.splice(index, 1);
      if (!items.length) {
        dialog.close();
        return;
      }
      index = Math.min(index, items.length - 1);
      draw();
    } catch (error) {
      handleError(error, 'delete photo');
    } finally {
      busy = false;
      remove.disabled = false;
      remove.replaceChildren(...original);
    }
  });

  dialog.addEventListener('close', () => {
    if (document.fullscreenElement === dialog) document.exitFullscreen().catch(() => {});
    dialog.remove();
  });

  draw();
  document.body.appendChild(dialog);
  dialog.showModal();
  close.focus();
}
