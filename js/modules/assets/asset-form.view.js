/**
 * Create / edit an asset. Sections are short and numbered (easier to follow, ADHD-friendly).
 * Photos: choose from the device or take one with the camera; all are compressed before upload.
 * While typing the name, existing articles with a similar name are listed (to avoid duplicates);
 * the service refuses the same name in the same location.
 * New articles get the signed-in user's department by default (it can be changed).
 */
import { h, icon, inventoryLoader, mount, pageHeader } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
import { session } from '../../core/session.js';
import { notify, handleError } from '../../core/notify.js';
import { AVAILABILITY, CONDITIONS, LIMITS } from '../../config/app-config.js';
import { field, input, select, runSubmit } from '../../shared/form.js';
import { compressImage } from '../../shared/image.js';
import { isCameraSupported, takePhoto } from '../../shared/camera.js';
import { formatNumber, todayIso } from '../../shared/format.js';
import { assetStore } from './asset.store.js';
import { CATALOG_STORES, assetTypeStore, categoryStore, locationStore, catalogLookups, catalogOptions, catalogsReady } from '../catalogs/catalog.store.js';
import { createAsset, updateAsset } from './asset.service.js';
import { sanitizePhotos, availabilityOf, isUnavailable, findSimilarAssets } from './asset.model.js';
import { availabilityBadge, conditionBadge } from './asset-ui.js';

const L = LIMITS.asset;

/** Fields shown as on/off switches (their value is `checked`, not `value`). */
const TOGGLES = Object.freeze(['builtIn', 'insured']);

/** The signed-in user's department, if it still exists. */
function defaultDepartment() {
  const id = session.profile?.departmentId;
  return id && categoryStore.getById(id) ? id : '';
}

/** Checkbox shown as a switch, inside the same `.field` wrapper as field() (so errors can show). */
function toggleField({ label, name, control, hint }) {
  control.name = name;
  return h(
    'div',
    { class: 'field', dataset: { field: name } },
    h('label', { class: 'switch-label toggle-field' }, control, h('span', null, label)),
    hint ? h('p', { class: 'hint' }, hint) : null,
    h('p', { class: 'field-error', hidden: true }),
  );
}

/**
 * Existing articles with a similar name, listed while typing. Choosing one shows its main data and a
 * link to open it, so the user can confirm whether the article is already registered.
 * @param {HTMLInputElement} nameInput
 * @param {string|null} excludeId the article being edited
 */
function similarNames(nameInput, excludeId) {
  const title = h('p', { class: 'similar-title' });
  const list = h('ul', { class: 'similar-list' });
  const chosen = h('div', { class: 'similar-chosen', hidden: true });
  const box = h('section', { class: 'similar field--wide', hidden: true, 'aria-live': 'polite', 'aria-label': 'Artículos con nombre parecido' }, title, list, chosen);

  const where = (asset) => [catalogLookups.locationName(asset.locationId), asset.code].filter(Boolean).join(' · ');

  function choose(asset) {
    mount(
      chosen,
      h('p', null, h('strong', null, 'Ya registrado: '), asset.name),
      h(
        'dl',
        { class: 'details details--compact' },
        [
          ['Código', asset.code || '—'],
          ['Tipo de artículo', catalogLookups.typeName(asset.typeId)],
          ['Departamento', catalogLookups.categoryName(asset.categoryId)],
          ['Ubicación', catalogLookups.locationName(asset.locationId)],
          ['Estado', [conditionBadge(asset.condition), ' ', availabilityBadge(asset)]],
          ['Cantidad', formatNumber(asset.quantity)],
        ].map(([label, value]) => [h('dt', null, label), h('dd', null, value)]),
      ),
      h('p', { class: 'hint' }, 'Si es el mismo artículo, no lo registre de nuevo: ábralo y aumente su cantidad.'),
      h('a', { href: `#/assets/${encodeURIComponent(asset.id)}`, class: 'btn btn-secondary btn-small', target: '_blank', rel: 'noopener' }, 'Ver artículo (pestaña nueva)'),
    );
    chosen.hidden = false;
  }

  function update() {
    const matches = findSimilarAssets(assetStore.getAll(), nameInput.value, { excludeId });
    box.hidden = matches.length === 0;
    chosen.hidden = true;
    title.textContent = matches.length === 1 ? 'Ya existe 1 artículo con un nombre parecido:' : `Ya existen ${matches.length} artículos con un nombre parecido:`;
    mount(
      list,
      matches.map((asset) =>
        h(
          'li',
          null,
          h('button', { type: 'button', class: 'similar-item', onclick: () => choose(asset) }, h('strong', null, asset.name), h('small', { class: 'muted' }, where(asset))),
        ),
      ),
    );
  }

  let debounce = 0;
  nameInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(update, 200);
  });
  return { node: box, dispose: () => clearTimeout(debounce) };
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
        notify.info(`Máximo ${L.photos} fotos por artículo.`);
        break;
      }
      try {
        mount(status, inventoryLoader({ label: 'Procesando foto…', size: 'small' }));
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
    h('h2', null, 'Faltan registros'),
    h('p', null, 'Antes de registrar un artículo, cree al menos un tipo de artículo, un departamento y una ubicación.'),
    h('a', { href: '#/records', class: 'btn btn-primary' }, 'Ir a registros'),
  );
}

export async function render(container, { params }) {
  await Promise.all([assetStore.whenReady(), catalogsReady()]);
  const editing = Boolean(params.id);
  const asset = editing ? assetStore.getById(params.id) : null;
  if (editing && !asset) {
    notify.info('El artículo no existe o fue eliminado.');
    navigate('/assets');
    return undefined;
  }

  const backHref = editing ? `#/assets/${encodeURIComponent(asset.id)}` : '#/assets';
  const title = editing ? `Editar: ${asset.name}` : 'Registrar artículo';

  if (CATALOG_STORES.some((store) => !store.getAll().length)) {
    mount(container, pageHeader(title), missingCatalogsNotice());
    return undefined;
  }

  const v = asset ?? {};
  const controls = {
    name: input({ maxlength: L.name, value: v.name ?? '', autocomplete: 'off' }),
    code: input({ maxlength: L.code, value: v.code ?? '', autocomplete: 'off' }),
    description: h('textarea', { rows: '3', maxlength: L.description }, v.description ?? ''),
    brand: input({ maxlength: L.brand, value: v.brand ?? '', autocomplete: 'off' }),
    model: input({ maxlength: L.model, value: v.model ?? '', autocomplete: 'off' }),
    serialNumber: input({ maxlength: L.serialNumber, value: v.serialNumber ?? '', autocomplete: 'off', spellcheck: 'false' }),
    builtIn: h('input', { type: 'checkbox', class: 'switch', checked: v.builtIn === true }),
    insured: h('input', { type: 'checkbox', class: 'switch', checked: v.insured === true }),
    typeId: select(catalogOptions(assetTypeStore), { value: v.typeId ?? '', placeholder: 'Elija…' }),
    categoryId: select(catalogOptions(categoryStore), { value: editing ? v.categoryId ?? '' : defaultDepartment(), placeholder: 'Elija…' }),
    locationId: select(catalogOptions(locationStore), { value: v.locationId ?? '', placeholder: 'Elija…' }),
    tags: input({ maxlength: L.tags * (L.tagLength + 2), value: (v.tags ?? []).join(', '), autocomplete: 'off' }),
    condition: select(CONDITIONS, { value: v.condition ?? 'good' }),
    availability: select(AVAILABILITY, { value: availabilityOf(v) }),
    unavailableReason: input({ maxlength: L.unavailableReason, value: isUnavailable(availabilityOf(v)) ? v.unavailableReason ?? '' : '', autocomplete: 'off' }),
    notes: h('textarea', { rows: '2', maxlength: L.notes }, v.notes ?? ''),
    quantity: input({ type: 'number', inputmode: 'numeric', min: 1, max: L.maxQuantity, step: 1, value: v.quantity ?? 1 }),
    value: input({ type: 'number', inputmode: 'decimal', min: 0, max: L.maxValue, step: '0.01', value: v.value ?? '' }),
    acquisitionDate: input({ type: 'date', max: todayIso(), value: v.acquisitionDate ?? '' }),
  };
  // The reason is asked only while the article is not available (loaned, under repair, missing).
  const reasonField = field({
    label: 'Motivo de no disponibilidad',
    name: 'unavailableReason',
    control: controls.unavailableReason,
    hint: 'Opcional. Ej.: Prestado al grupo de jóvenes hasta junio.',
  });
  const syncReason = () => {
    reasonField.hidden = !isUnavailable(controls.availability.value);
  };
  controls.availability.addEventListener('change', syncReason);
  syncReason();
  const photos = createPhotoState(v.photos);
  const similar = similarNames(controls.name, asset?.id ?? null);
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, editing ? 'Guardar cambios' : 'Registrar artículo');

  const form = h(
    'form',
    { class: 'stack', novalidate: true, 'aria-label': title },
    h(
      'fieldset',
      { class: 'card form-grid' },
      h('legend', null, '1. Datos básicos'),
      field({ label: 'Código de inventario', name: 'code', control: controls.code, hint: 'Opcional. Ej.: SILLA-001' }),
      field({ label: 'Nombre del artículo', name: 'name', control: controls.name, required: true, hint: 'Ej.: Silla plástica blanca. Le mostraremos los parecidos ya registrados.' }),
      similar.node,
      field({ label: 'Descripción', name: 'description', control: controls.description, wide: true, hint: `Opcional. Máximo ${L.description} caracteres.` }),
      field({ label: 'Marca', name: 'brand', control: controls.brand, hint: 'Opcional. Ej.: Yamaha' }),
      field({ label: 'Modelo', name: 'model', control: controls.model, hint: 'Opcional. Ej.: MG10XU' }),
      field({ label: 'Nro. de serie', name: 'serialNumber', control: controls.serialNumber, hint: 'Opcional. Está en la etiqueta del fabricante.' }),
      toggleField({ label: 'Empotrado', name: 'builtIn', control: controls.builtIn, hint: 'Fijo al edificio (no se puede mover).' }),
      toggleField({ label: 'Asegurado', name: 'insured', control: controls.insured, hint: 'Tiene póliza de seguro.' }),
    ),
    h(
      'fieldset',
      { class: 'card form-grid' },
      h('legend', null, '2. Clasificación'),
      field({ label: 'Tipo de artículo', name: 'typeId', control: controls.typeId, required: true, hint: 'Ej.: Mobiliario, Equipo de sonido, Vehículos.' }),
      field({ label: 'Departamento', name: 'categoryId', control: controls.categoryId, required: true, hint: editing ? 'Ministerio responsable.' : 'Ministerio responsable. Se propone el suyo; puede cambiarlo.' }),
      field({ label: 'Ubicación', name: 'locationId', control: controls.locationId, required: true }),
      field({ label: 'Etiquetas', name: 'tags', control: controls.tags, wide: true, hint: `Separadas por comas, máximo ${L.tags}. Ej.: donación, jóvenes` }),
    ),
    h(
      'fieldset',
      { class: 'card form-grid' },
      h('legend', null, '3. Estado y valor'),
      field({ label: 'Estado', name: 'condition', control: controls.condition, required: true }),
      field({ label: 'Disponibilidad', name: 'availability', control: controls.availability, required: true }),
      reasonField,
      field({ label: 'Cantidad', name: 'quantity', control: controls.quantity, required: true }),
      field({ label: 'Valor unitario', name: 'value', control: controls.value, hint: 'Opcional. Valor estimado de una unidad.' }),
      field({ label: 'Fecha de adquisición', name: 'acquisitionDate', control: controls.acquisitionDate }),
      field({ label: 'Observaciones', name: 'notes', control: controls.notes, wide: true, hint: `Opcional. Comentarios sobre el estado del artículo. Máximo ${L.notes} caracteres.` }),
    ),
    photoSection(photos),
    h('div', { class: 'button-row form-actions' }, h('a', { href: backHref, class: 'btn btn-secondary' }, 'Cancelar'), submit),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(
      Object.entries(controls).map(([name, control]) => [name, TOGGLES.includes(name) ? control.checked : control.value]),
    );
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
      notify.success(editing ? 'Cambios guardados.' : 'Artículo registrado.');
      // New article → back to the list; edited article → its detail.
      navigate(editing ? `/assets/${encodeURIComponent(savedId)}` : '/assets');
    }
  });

  mount(container, pageHeader(title), form);
  return () => {
    similar.dispose();
    photos.dispose();
  };
}
