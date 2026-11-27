/** Reports page: choose filters (and whether to include photos), preview the count, download the PDF. */
import { h, icon, mount, pageHeader } from '../../core/dom.js';
import { session } from '../../core/session.js';
import { notify, handleError } from '../../core/notify.js';
import { AVAILABILITY, CONDITIONS } from '../../config/app-config.js';
import { field, select } from '../../shared/form.js';
import { formatNumber } from '../../shared/format.js';
import { assetStore } from '../assets/asset.store.js';
import { assetTypeStore, categoryStore, locationStore, catalogLookups, catalogOptions, catalogsReady } from '../catalogs/catalog.store.js';
import { EMPTY_FILTERS, filterAssets, sortAssets } from '../assets/asset-filter.js';
import { generateInventoryPdf } from './report.service.js';

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

export async function render(container) {
  await Promise.all([assetStore.whenReady(), catalogsReady()]);

  const type = select(catalogOptions(assetTypeStore), { placeholder: 'Todas' });
  const category = select(catalogOptions(categoryStore), { placeholder: 'Todos' });
  const place = select(catalogOptions(locationStore), { placeholder: 'Todas' });
  const condition = select(CONDITIONS, { placeholder: 'Todos' });
  const availability = select(AVAILABILITY, { placeholder: 'Toda' });
  const includePhotos = h('input', { type: 'checkbox', class: 'switch', id: 'report-photos', checked: true });
  const preview = h('p', { class: 'lead', role: 'status' });
  const generate = h('button', { type: 'button', class: 'btn btn-primary' });
  const setButtonLabel = (text) => generate.replaceChildren(icon('download'), text);
  setButtonLabel('Descargar PDF');

  const currentFilters = () => ({
    ...EMPTY_FILTERS,
    typeId: type.value,
    categoryId: category.value,
    locationId: place.value,
    condition: condition.value,
    availability: availability.value,
  });
  const selection = () => sortAssets(filterAssets(assetStore.getAll(), currentFilters(), catalogLookups), 'name:asc');
  const describeFilters = () => {
    const parts = [
      type.value ? `Categoría: ${catalogLookups.typeName(type.value)}` : '',
      category.value ? `Departamento: ${catalogLookups.categoryName(category.value)}` : '',
      place.value ? `Ubicación: ${catalogLookups.locationName(place.value)}` : '',
      condition.value ? `Estado: ${CONDITIONS[condition.value]}` : '',
      availability.value ? `Disponibilidad: ${AVAILABILITY[availability.value]}` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Todos los artículos';
  };
  let busy = false;
  const updatePreview = () => {
    const assets = selection();
    const withPhoto = assets.filter((asset) => asset.photos?.[0]?.url).length;
    const photoNote = includePhotos.checked && withPhoto ? `, ${formatNumber(withPhoto)} con foto` : '';
    preview.textContent = `El reporte incluirá ${formatNumber(assets.length)} artículo${assets.length === 1 ? '' : 's'}${photoNote}.`;
    generate.disabled = busy || assets.length === 0;
  };

  [type, category, place, condition, availability, includePhotos].forEach((control) => control.addEventListener('change', updatePreview));

  generate.addEventListener('click', async () => {
    busy = true;
    generate.disabled = true;
    setButtonLabel('Preparando…');
    try {
      const outcome = await generateInventoryPdf({
        assets: selection(),
        lookups: catalogLookups,
        filterSummary: describeFilters(),
        generatedBy: session.profile.displayName,
        includePhotos: includePhotos.checked,
        onProgress: (done, total) => total && setButtonLabel(`Preparando fotos ${done} de ${total}…`),
      });
      const warning = photoOutcomeMessage(outcome);
      if (warning) notify.info(warning);
      else notify.success('Reporte descargado.');
    } catch (error) {
      handleError(error, 'pdf report');
    } finally {
      busy = false;
      setButtonLabel('Descargar PDF');
      updatePreview();
    }
  });

  mount(
    container,
    pageHeader('Reportes'),
    h(
      'section',
      { class: 'card form-grid' },
      h('h2', { class: 'field--wide' }, 'Informe de inventario (PDF)'),
      h('p', { class: 'muted field--wide' }, 'Incluye detalle de cada artículo: categoría, departamento, ubicación, estado, disponibilidad y valor, con un resumen al inicio.'),
      field({ label: 'Categoría', name: 'typeId', control: type }),
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
      h('div', { class: 'field--wide stack' }, preview, h('div', { class: 'button-row' }, generate)),
    ),
  );
  updatePreview();
  const unsubscribe = assetStore.subscribe(updatePreview);
  return unsubscribe;
}
