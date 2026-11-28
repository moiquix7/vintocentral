/**
 * Reports page: two PDFs, each in its own card with filters, a live count and a download button.
 *   1. Informe de artículos (report.service.js) — optionally with photos.
 *   2. Informe de toma de inventario (taking-report.service.js) — progress of the current round.
 */
import { h, icon, inventoryLoader, mount, pageHeader } from '../../core/dom.js';
import { session } from '../../core/session.js';
import { notify, handleError } from '../../core/notify.js';
import { AVAILABILITY, CONDITIONS } from '../../config/app-config.js';
import { field, input, select } from '../../shared/form.js';
import { formatNumber, todayIso } from '../../shared/format.js';
import { assetStore } from '../assets/asset.store.js';
import { assetTypeStore, categoryStore, locationStore, catalogLookups, catalogOptions, catalogsReady } from '../catalogs/catalog.store.js';
import { EMPTY_FILTERS, filterAssets, sortAssets } from '../assets/asset-filter.js';
import { inventoryProgress, normalizeRoundStart } from '../inventory/inventory.model.js';
import { loadRoundStart } from '../inventory/inventory-round.store.js';
import { generateAssetReportPdf } from './report.service.js';
import { generateTakingReportPdf } from './taking-report.service.js';

const ALL_DEPARTMENTS = 'Todos los departamentos';

function photoOutcomeMessage({ failedPhotos, blockedPhotos, totalPhotos }) {
  if (!failedPhotos) return null;
  if (blockedPhotos) {
    return 'El reporte salió sin fotos porque Firebase Storage todavía no permite descargarlas (falta configurar CORS). El administrador debe hacerlo una sola vez: docs/deployment.md, paso 4b.';
  }
  if (failedPhotos === totalPhotos) {
    return 'El reporte se descargó sin fotos: no se pudieron descargar. Revise su conexión e intente de nuevo.';
  }
  return `El reporte se descargó, pero ${failedPhotos} de ${totalPhotos} fotos no se pudieron incluir (aparecen con "—").`;
}

const plural = (count, word) => `${formatNumber(count)} ${word}${count === 1 ? '' : 's'}`;

/**
 * Download button with the animated loader while busy. `run` receives setLabel for progress texts.
 * @param {(setLabel: (text: string) => void) => Promise<void>} run
 */
function downloadButton(run, onSettled) {
  const button = h('button', { type: 'button', class: 'btn btn-primary' });
  const setLabel = (text, working = false) =>
    button.replaceChildren(...(working ? [inventoryLoader({ label: text, size: 'small' })] : [icon('download'), text]));
  setLabel('Descargar PDF');
  let busy = false;
  button.addEventListener('click', async () => {
    busy = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    setLabel('Preparando reporte…', true);
    try {
      await run((text) => setLabel(text, true));
    } catch (error) {
      handleError(error, 'pdf report');
    } finally {
      busy = false;
      button.removeAttribute('aria-busy');
      setLabel('Descargar PDF');
      onSettled();
    }
  });
  return { button, isBusy: () => busy };
}

function assetReportCard() {
  const type = select(catalogOptions(assetTypeStore), { placeholder: 'Todas' });
  const category = select(catalogOptions(categoryStore), { placeholder: 'Todos' });
  const place = select(catalogOptions(locationStore), { placeholder: 'Todas' });
  const condition = select(CONDITIONS, { placeholder: 'Todos' });
  const availability = select(AVAILABILITY, { placeholder: 'Toda' });
  const includePhotos = h('input', { type: 'checkbox', class: 'switch', id: 'report-photos', checked: true });
  const preview = h('p', { class: 'lead', role: 'status' });

  const selection = () =>
    sortAssets(
      filterAssets(
        assetStore.getAll(),
        { ...EMPTY_FILTERS, typeId: type.value, categoryId: category.value, locationId: place.value, condition: condition.value, availability: availability.value },
        catalogLookups,
      ),
      'name:asc',
    );
  const describeOtherFilters = () =>
    [
      type.value ? `Tipo de artículo: ${catalogLookups.typeName(type.value)}` : '',
      place.value ? `Ubicación: ${catalogLookups.locationName(place.value)}` : '',
      condition.value ? `Estado: ${CONDITIONS[condition.value]}` : '',
      availability.value ? `Disponibilidad: ${AVAILABILITY[availability.value]}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

  const download = downloadButton(async (setLabel) => {
    const outcome = await generateAssetReportPdf({
      assets: selection(),
      department: category.value ? catalogLookups.categoryName(category.value) : ALL_DEPARTMENTS,
      filterSummary: describeOtherFilters(),
      generatedBy: session.profile.displayName,
      includePhotos: includePhotos.checked,
      onProgress: (done, total) => total && setLabel(`Preparando fotos ${done} de ${total}…`),
    });
    const warning = photoOutcomeMessage(outcome);
    if (warning) notify.info(warning);
    else notify.success('Reporte descargado.');
  }, () => update());

  function update() {
    const assets = selection();
    const withPhoto = assets.filter((asset) => asset.photos?.[0]?.url).length;
    const photoNote = includePhotos.checked && withPhoto ? `, ${formatNumber(withPhoto)} con foto` : '';
    preview.textContent = `El reporte incluirá ${plural(assets.length, 'artículo')}${photoNote}.`;
    download.button.disabled = download.isBusy() || assets.length === 0;
  }
  [type, category, place, condition, availability, includePhotos].forEach((control) => control.addEventListener('change', update));

  const node = h(
    'section',
    { class: 'card form-grid' },
    h('h2', { class: 'field--wide' }, 'Informe de artículos (PDF)'),
    h(
      'p',
      { class: 'muted field--wide' },
      'Encabezado con el departamento, la fecha y quién lo genera; una tabla con fecha de adquisición, artículo, marca, modelo, nro. de serie, cantidad y estado (con o sin foto); y al final tres espacios para firmar: Anciano del Departamento, Líder entrante y Líder saliente.',
    ),
    field({ label: 'Tipo de artículo', name: 'typeId', control: type }),
    field({ label: 'Departamento', name: 'categoryId', control: category }),
    field({ label: 'Ubicación', name: 'locationId', control: place }),
    field({ label: 'Estado', name: 'condition', control: condition }),
    field({ label: 'Disponibilidad', name: 'availability', control: availability }),
    h(
      'div',
      { class: 'pref-row' },
      h('label', { class: 'switch-label', for: 'report-photos' }, includePhotos, 'Incluir fotos'),
      h('p', { class: 'hint' }, 'Muestra la primera foto de cada artículo. Tarda un poco más.'),
    ),
    h('div', { class: 'field--wide stack' }, preview, h('div', { class: 'button-row' }, download.button)),
  );
  return { node, update };
}

function takingReportCard() {
  const category = select(catalogOptions(categoryStore), { placeholder: 'Todos' });
  const place = select(catalogOptions(locationStore), { placeholder: 'Todas' });
  const roundStart = input({ type: 'date', max: todayIso(), value: loadRoundStart() });
  const preview = h('p', { class: 'lead', role: 'status' });

  const roundDate = () => normalizeRoundStart(roundStart.value, todayIso());
  // Walking order, as in the inventory-taking grid.
  const selection = () =>
    sortAssets(
      filterAssets(assetStore.getAll(), { ...EMPTY_FILTERS, categoryId: category.value, locationId: place.value }, catalogLookups),
      'location:asc',
      catalogLookups,
    );

  const download = downloadButton(async () => {
    await generateTakingReportPdf({
      assets: selection(),
      roundStart: roundDate(),
      department: category.value ? catalogLookups.categoryName(category.value) : ALL_DEPARTMENTS,
      filterSummary: place.value ? `Ubicación: ${catalogLookups.locationName(place.value)}` : '',
      generatedBy: session.profile.displayName,
      lookups: catalogLookups,
    });
    notify.success('Reporte descargado.');
  }, () => update());

  function update() {
    roundStart.value = roundDate();
    const assets = selection();
    const { checked, total } = inventoryProgress(assets, roundStart.value);
    preview.textContent = `El reporte incluirá ${plural(total, 'artículo')}: ${formatNumber(checked)} verificados y ${formatNumber(total - checked)} pendientes.`;
    download.button.disabled = download.isBusy() || total === 0;
  }
  [category, place, roundStart].forEach((control) => control.addEventListener('change', update));

  const node = h(
    'section',
    { class: 'card form-grid' },
    h('h2', { class: 'field--wide' }, 'Informe de toma de inventario (PDF)'),
    h(
      'p',
      { class: 'muted field--wide' },
      'Un resumen del avance (verificados, pendientes y acciones propuestas) y una tabla con ubicación, estado, disponibilidad, fecha de verificación, acción propuesta y observaciones de cada artículo. Al final, dos espacios para firmar: el suyo y uno en blanco.',
    ),
    field({ label: 'Departamento', name: 'takingCategoryId', control: category }),
    field({ label: 'Ubicación', name: 'takingLocationId', control: place }),
    field({ label: 'Inventario iniciado el', name: 'takingRoundStart', control: roundStart, hint: 'La misma fecha de la página Toma de inventario.' }),
    h('div', { class: 'field--wide stack' }, preview, h('div', { class: 'button-row' }, download.button)),
  );
  return { node, update };
}

export async function render(container) {
  await Promise.all([assetStore.whenReady(), catalogsReady()]);
  const assetsCard = assetReportCard();
  const takingCard = takingReportCard();
  mount(container, pageHeader('Reportes'), assetsCard.node, takingCard.node);
  const refresh = () => {
    assetsCard.update();
    takingCard.update();
  };
  refresh();
  return assetStore.subscribe(refresh);
}
