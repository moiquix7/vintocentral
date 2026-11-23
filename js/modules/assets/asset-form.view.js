/**
 * Create / edit an asset. Sections are short and numbered (easier to follow, ADHD-friendly).
 * Photos: choose from the device or take one with the camera; all are compressed before upload.
 */
import { h, icon, mount, pageHeader } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
import { notify, handleError } from '../../core/notify.js';
import { CONDITIONS, LIMITS } from '../../config/app-config.js';
import { field, input, select, runSubmit } from '../../shared/form.js';
import { compressImage } from '../../shared/image.js';
import { isCameraSupported, takePhoto } from '../../shared/camera.js';
import { todayIso } from '../../shared/format.js';
import { assetStore } from './asset.store.js';
import { categoryStore, locationStore } from '../catalogs/catalog.store.js';
import { createAsset, updateAsset } from './asset.service.js';
import { sanitizePhotos } from './asset.model.js';

const L = LIMITS.asset;

function catalogOptions(store) {
  return Object.fromEntries(store.getAll().map((item) => [item.id, item.name]));
}

/** Photo state: existing (already in Storage) + new (local blobs with preview URLs). */
function createPhotoState(existing) {
  const kept = sanitizePhotos(existing);
  const removed = [];
  const added = []; // { blob, previewUrl }
  return {
    get count() {
      return kept.length + added.length;
    },
    kept,
    removed,
    added,
    removeKept(index) {
      removed.push(...kept.splice(index, 1));
    },
    removeAdded(index) {
      const [item] = added.splice(index, 1);
      if (item) URL.revokeObjectURL(item.previewUrl);
    },
    add(blob) {
      added.push({ blob, previewUrl: URL.createObjectURL(blob) });
    },
    dispose() {
      added.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    },
  };
}

function photoSection(photos) {
  const list = h('ul', { class: 'gallery gallery--edit' });
  const status = h('p', { class: 'hint', role: 'status' });
  const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });
  const chooseButton = h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => fileInput.click() }, icon('image'), 'Elegir foto');
  const cameraButton = h('button', { type: 'button', class: 'btn btn-secondary' }, icon('camera'), 'Tomar foto');
  // Without getUserMedia, mobile browsers still open the camera through the `capture` attribute.
  const captureInput = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });

  function draw() {
    const full = photos.count >= L.photos;
    status.textContent = `${photos.count} de ${L.photos} fotos.`;
    chooseButton.disabled = full;
    fileInput.disabled = full;
    cameraButton.disabled = full;
    captureInput.disabled = full;
    const item = (src, label, onRemove) =>
      h(
        'li',
        null,
        h('img', { src, alt: label }),
        h('button', { type: 'button', class: 'btn btn-danger btn-small', onclick: onRemove }, icon('trash'), 'Quitar'),
      );
    mount(
      list,
      photos.kept.map((p, i) => item(p.url, `Foto guardada ${i + 1}`, () => { photos.removeKept(i); draw(); })),
      photos.added.map((p, i) => item(p.previewUrl, `Foto nueva ${i + 1}`, () => { photos.removeAdded(i); draw(); })),
    );
  }

  async function addBlobs(blobs) {
    for (const blob of blobs) {
      if (photos.count >= L.photos) {
        notify.info(`Máximo ${L.photos} fotos por bien.`);
        break;
      }
      try {
        status.textContent = 'Procesando foto…';
        photos.add(await compressImage(blob));
      } catch (error) {
        handleError(error, 'photo');
      }
    }
    draw();
  }

  const onFiles = (event) => {
    addBlobs([...event.target.files]);
    event.target.value = '';
  };
  fileInput.addEventListener('change', onFiles);
  captureInput.addEventListener('change', onFiles);
  cameraButton.addEventListener('click', async () => {
    if (!isCameraSupported()) {
      captureInput.click();
      return;
    }
    try {
      const blob = await takePhoto();
      if (blob) await addBlobs([blob]);
    } catch (error) {
      handleError(error, 'camera');
    }
  });

  draw();
  return h(
    'fieldset',
    { class: 'card' },
    h('legend', null, '4. Fotos'),
    h('p', { class: 'hint' }, `Hasta ${L.photos} fotos. Se reducen automáticamente para ahorrar espacio.`),
    list,
    status,
    h('div', { class: 'button-row' }, chooseButton, fileInput, cameraButton, captureInput),
  );
}

function missingCatalogsNotice() {
  return h(
    'section',
    { class: 'card empty-state' },
    h('h2', null, 'Faltan departamentos o ubicaciones'),
    h('p', null, 'Antes de registrar un bien, cree al menos un departamento y una ubicación.'),
    h('a', { href: '#/catalogs', class: 'btn btn-primary' }, 'Ir a departamentos y ubicaciones'),
  );
}

export async function render(container, { params }) {
  await Promise.all([assetStore.whenReady(), categoryStore.whenReady(), locationStore.whenReady()]);
  const editing = Boolean(params.id);
  const asset = editing ? assetStore.getById(params.id) : null;
  if (editing && !asset) {
    notify.info('El bien no existe o fue eliminado.');
    navigate('/assets');
    return undefined;
  }

  const backHref = editing ? `#/assets/${encodeURIComponent(asset.id)}` : '#/assets';
  const title = editing ? `Editar: ${asset.name}` : 'Registrar bien';

  if (!categoryStore.getAll().length || !locationStore.getAll().length) {
    mount(container, pageHeader(title), missingCatalogsNotice());
    return undefined;
  }

  const v = asset ?? {};
  const controls = {
    name: input({ maxlength: L.name, value: v.name ?? '', autocomplete: 'off' }),
    code: input({ maxlength: L.code, value: v.code ?? '', autocomplete: 'off' }),
    description: h('textarea', { rows: '3', maxlength: L.description }, v.description ?? ''),
    categoryId: select(catalogOptions(categoryStore), { value: v.categoryId ?? '', placeholder: 'Elija…' }),
    locationId: select(catalogOptions(locationStore), { value: v.locationId ?? '', placeholder: 'Elija…' }),
    tags: input({ maxlength: L.tags * (L.tagLength + 2), value: (v.tags ?? []).join(', '), autocomplete: 'off' }),
    condition: select(CONDITIONS, { value: v.condition ?? 'good' }),
    quantity: input({ type: 'number', inputmode: 'numeric', min: 1, max: L.maxQuantity, step: 1, value: v.quantity ?? 1 }),
    value: input({ type: 'number', inputmode: 'decimal', min: 0, max: L.maxValue, step: '0.01', value: v.value ?? '' }),
    acquisitionDate: input({ type: 'date', max: todayIso(), value: v.acquisitionDate ?? '' }),
  };
  const photos = createPhotoState(v.photos);
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, editing ? 'Guardar cambios' : 'Registrar bien');

  const form = h(
    'form',
    { class: 'stack', novalidate: true, 'aria-label': title },
    h(
      'fieldset',
      { class: 'card form-grid' },
      h('legend', null, '1. Datos básicos'),
      field({ label: 'Nombre del bien', name: 'name', control: controls.name, required: true, hint: 'Ej.: Silla plástica blanca' }),
      field({ label: 'Código de inventario', name: 'code', control: controls.code, hint: 'Opcional. Ej.: SILLA-001' }),
      field({ label: 'Descripción', name: 'description', control: controls.description, wide: true, hint: `Opcional. Máximo ${L.description} caracteres.` }),
    ),
    h(
      'fieldset',
      { class: 'card form-grid' },
      h('legend', null, '2. Clasificación'),
      field({ label: 'Departamento', name: 'categoryId', control: controls.categoryId, required: true }),
      field({ label: 'Ubicación', name: 'locationId', control: controls.locationId, required: true }),
      field({ label: 'Etiquetas', name: 'tags', control: controls.tags, wide: true, hint: `Separadas por comas, máximo ${L.tags}. Ej.: donación, jóvenes` }),
    ),
    h(
      'fieldset',
      { class: 'card form-grid' },
      h('legend', null, '3. Estado y valor'),
      field({ label: 'Estado', name: 'condition', control: controls.condition, required: true }),
      field({ label: 'Cantidad', name: 'quantity', control: controls.quantity, required: true }),
      field({ label: 'Valor unitario', name: 'value', control: controls.value, hint: 'Opcional. Valor estimado de una unidad.' }),
      field({ label: 'Fecha de adquisición', name: 'acquisitionDate', control: controls.acquisitionDate }),
    ),
    photoSection(photos),
    h('div', { class: 'button-row form-actions' }, h('a', { href: backHref, class: 'btn btn-secondary' }, 'Cancelar'), submit),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(Object.entries(controls).map(([name, control]) => [name, control.value]));
    let savedId = asset?.id ?? null;
    const ok = await runSubmit(form, submit, async () => {
      if (editing) {
        await updateAsset(asset.id, values, {
          keptPhotos: photos.kept,
          removedPhotos: photos.removed,
          newPhotos: photos.added.map((p) => p.blob),
        });
      } else {
        savedId = await createAsset(values, photos.added.map((p) => p.blob));
      }
    });
    if (ok) {
      notify.success(editing ? 'Cambios guardados.' : 'Bien registrado.');
      navigate(`/assets/${encodeURIComponent(savedId)}`);
    }
  });

  mount(container, pageHeader(title), form);
  return () => photos.dispose();
}
