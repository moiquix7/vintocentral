/**
 * Create / edit an asset as a step-by-step form (shared/stepper.js): 1. Datos básicos, 2. Clasificación,
 * 3. Estado y valor, 4. Fotos y revisión. Each step validates its own fields before moving on; editing can
 * open any step and save from any step (senior- and ADHD-friendly).
 * Photos: choose from the device or take one with the camera; all are compressed before upload.
 * While typing the name, existing articles with a similar name are listed (to avoid duplicates);
 * the service refuses the same name in the same location.
 * New articles get the signed-in user's department by default (it can be changed).
 */
import { h, icon, inventoryLoader, mount, pageHeader } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
import { session } from '../../core/session.js';
import { notify, handleError } from '../../core/notify.js';
import { APP, AVAILABILITY, CONDITIONS, LIMITS } from '../../config/app-config.js';
import { field, input, select, runSubmit } from '../../shared/form.js';
import { createStepper } from '../../shared/stepper.js';
import { compressImage } from '../../shared/image.js';
import { isCameraSupported, takePhoto } from '../../shared/camera.js';
import { amountInputValue, formatCurrency, formatNumber, todayIso } from '../../shared/format.js';
import { hasAtMostTwoDecimals, toNumber } from '../../shared/validation.js';
import { assetStore } from './asset.store.js';
import { CATALOG_STORES, assetTypeStore, categoryStore, locationStore, catalogLookups, catalogOptions, catalogsReady } from '../catalogs/catalog.store.js';
import { createAsset, updateAsset } from './asset.service.js';
import { sanitizeAsset, validateAsset, sanitizePhotos, availabilityOf, isUnavailable, findSimilarAssets } from './asset.model.js';
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
    'div',
    { class: 'field--wide stack-tight' },
    h('p', { class: 'hint' }, `Hasta ${L.photos} fotos. Se reducen automáticamente para ahorrar espacio.`),
    list,
    status,
    h('div', { class: 'button-row' }, chooseButton, fileInput, cameraButton, captureInput),
  );
}

/** "Revise antes de guardar": the main data as it will be saved (refreshed when the last step opens). */
function reviewBox() {
  const list = h('dl', { class: 'details details--compact' });
  const node = h('section', { class: 'field--wide review', 'aria-label': 'Resumen' }, h('h3', null, 'Revise antes de guardar'), list);
  const update = (values, photoCount) => {
    const amount = toNumber(values.value);
    const rows = [
      ['Nombre', values.name || '—'],
      ['Tipo de artículo', values.typeId ? catalogLookups.typeName(values.typeId) : '—'],
      ['Departamento', values.categoryId ? catalogLookups.categoryName(values.categoryId) : '—'],
      ['Ubicación', values.locationId ? catalogLookups.locationName(values.locationId) : '—'],
      ['Estado', CONDITIONS[values.condition] ?? '—'],
      ['Disponibilidad', AVAILABILITY[values.availability] ?? '—'],
      ['Cantidad', values.quantity || '—'],
      ['Valor unitario', amount === null ? 'Sin valor' : formatCurrency(amount)],
      ['Fotos', `${photoCount} de ${L.photos}`],
    ];
    mount(list, rows.map(([label, value]) => [h('dt', null, label), h('dd', null, String(value))]));
  };
  return { node, update };
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
    value: input({ type: 'number', inputmode: 'decimal', min: 0, max: L.maxValue, step: '0.01', placeholder: '0.00', value: amountInputValue(v.value) }),
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
  // Amounts always show two decimals ("150" → "150.00"). Values with more decimals are left as typed,
  // so the validation message reports them instead of rounding silently.
  controls.value.addEventListener('change', () => {
    const amount = toNumber(controls.value.value);
    if (Number.isFinite(amount) && amount >= 0 && hasAtMostTwoDecimals(amount)) controls.value.value = amountInputValue(amount);
  });
  const photos = createPhotoState(v.photos);
  const similar = similarNames(controls.name, asset?.id ?? null);
  const review = reviewBox();
  const values = () =>
    Object.fromEntries(Object.entries(controls).map(([name, control]) => [name, TOGGLES.includes(name) ? control.checked : control.value]));

  const steps = [
    {
      title: 'Datos básicos',
      instructions: 'Escriba el nombre del artículo. Lo demás es opcional: complete lo que sepa.',
      fields: ['code', 'name', 'description', 'brand', 'model', 'serialNumber', 'builtIn', 'insured'],
      nodes: [
        field({ label: 'Nombre del artículo', name: 'name', control: controls.name, required: true, hint: 'Ej.: Silla plástica blanca. Le mostraremos los parecidos ya registrados.' }),
        field({ label: 'Código de inventario', name: 'code', control: controls.code, hint: 'Opcional. Ej.: SILLA-001' }),
        similar.node,
        field({ label: 'Descripción', name: 'description', control: controls.description, wide: true, hint: `Opcional. Máximo ${L.description} caracteres.` }),
        field({ label: 'Marca', name: 'brand', control: controls.brand, hint: 'Opcional. Ej.: Yamaha' }),
        field({ label: 'Modelo', name: 'model', control: controls.model, hint: 'Opcional. Ej.: MG10XU' }),
        field({ label: 'Nro. de serie', name: 'serialNumber', control: controls.serialNumber, hint: 'Opcional. Está en la etiqueta del fabricante.' }),
        toggleField({ label: 'Empotrado', name: 'builtIn', control: controls.builtIn, hint: 'Fijo al edificio (no se puede mover).' }),
        toggleField({ label: 'Asegurado', name: 'insured', control: controls.insured, hint: 'Tiene póliza de seguro.' }),
      ],
    },
    {
      title: 'Clasificación',
      instructions: 'Elija qué tipo de artículo es, qué departamento lo cuida y dónde está.',
      fields: ['typeId', 'categoryId', 'locationId', 'tags'],
      nodes: [
        field({ label: 'Tipo de artículo', name: 'typeId', control: controls.typeId, required: true, hint: 'Ej.: Mobiliario, Equipo de sonido, Vehículos.' }),
        field({ label: 'Departamento', name: 'categoryId', control: controls.categoryId, required: true, hint: editing ? 'Ministerio responsable.' : 'Ministerio responsable. Se propone el suyo; puede cambiarlo.' }),
        field({ label: 'Ubicación', name: 'locationId', control: controls.locationId, required: true }),
        field({ label: 'Etiquetas', name: 'tags', control: controls.tags, wide: true, hint: `Opcional. Separadas por comas, máximo ${L.tags}. Ej.: donación, jóvenes` }),
      ],
    },
    {
      title: 'Estado y valor',
      instructions: '¿Cómo está el artículo y cuánto vale? Si no sabe el valor, déjelo vacío.',
      fields: ['condition', 'availability', 'unavailableReason', 'quantity', 'value', 'acquisitionDate', 'notes'],
      nodes: [
        field({ label: 'Estado', name: 'condition', control: controls.condition, required: true }),
        field({ label: 'Disponibilidad', name: 'availability', control: controls.availability, required: true }),
        reasonField,
        field({ label: 'Cantidad', name: 'quantity', control: controls.quantity, required: true }),
        field({
          label: `Valor unitario (${APP.currencySymbol})`,
          name: 'value',
          control: controls.value,
          prefix: APP.currencySymbol,
          hint: 'Opcional. Valor estimado de una unidad, en bolivianos con dos decimales. Ej.: 150.50',
        }),
        field({ label: 'Fecha de adquisición', name: 'acquisitionDate', control: controls.acquisitionDate, hint: 'Opcional.' }),
        field({ label: 'Observaciones', name: 'notes', control: controls.notes, wide: true, hint: `Opcional. Comentarios sobre el estado del artículo. Máximo ${L.notes} caracteres.` }),
      ],
    },
    {
      title: 'Fotos y revisión',
      instructions: editing
        ? 'Agregue o quite fotos y revise los datos. Luego pulse «Guardar cambios».'
        : 'Agregue fotos si puede (opcional), revise los datos y pulse «Registrar artículo».',
      fields: [],
      nodes: [photoSection(photos), review.node],
    },
  ];
  const lastStep = steps.length - 1;

  async function save(stepper) {
    const input = values();
    let savedId = asset?.id ?? null;
    const ok = await runSubmit(
      stepper.form,
      stepper.submitButton,
      async () => {
        if (editing) {
          await updateAsset(asset.id, input, {
            keptPhotos: photos.kept,
            removedPhotos: photos.removed,
            newPhotos: photos.added.map((p) => p.blob),
          });
        } else {
          savedId = await createAsset(input, photos.added.map((p) => p.blob));
        }
      },
      'Guardando…',
      { onInvalid: stepper.revealErrors },
    );
    if (ok) {
      notify.success(editing ? 'Cambios guardados.' : 'Artículo registrado.');
      // New article → back to the list; edited article → its detail.
      navigate(editing ? `/assets/${encodeURIComponent(savedId)}` : '/assets');
    }
  }

  const stepper = createStepper({
    label: title,
    steps,
    submitLabel: editing ? 'Guardar cambios' : 'Registrar artículo',
    freeNavigation: editing,
    cancel: h('a', { href: backHref, class: 'btn btn-secondary' }, 'Cancelar'),
    validateStep: () => validateAsset(sanitizeAsset(values())),
    onStepChange: (index) => {
      if (index === lastStep) review.update(values(), photos.count);
    },
    onSubmit: save,
  });
  const form = stepper.form;

  mount(container, pageHeader(title), form);
  return () => {
    similar.dispose();
    photos.dispose();
  };
}
