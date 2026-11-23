/** Reports page: choose filters, preview the count, download the PDF. */
import { h, icon, mount, pageHeader } from '../../core/dom.js';
import { session } from '../../core/session.js';
import { notify, handleError } from '../../core/notify.js';
import { CONDITIONS } from '../../config/app-config.js';
import { field, select } from '../../shared/form.js';
import { formatNumber } from '../../shared/format.js';
import { assetStore } from '../assets/asset.store.js';
import { categoryStore, locationStore, catalogLookups } from '../catalogs/catalog.store.js';
import { EMPTY_FILTERS, filterAssets, sortAssets } from '../assets/asset-filter.js';
import { generateInventoryPdf } from './report.service.js';

function options(store) {
  return Object.fromEntries(store.getAll().map((item) => [item.id, item.name]));
}

export async function render(container) {
  await Promise.all([assetStore.whenReady(), categoryStore.whenReady(), locationStore.whenReady()]);

  const category = select(options(categoryStore), { placeholder: 'Todos' });
  const place = select(options(locationStore), { placeholder: 'Todas' });
  const condition = select(CONDITIONS, { placeholder: 'Todos' });
  const preview = h('p', { class: 'lead', role: 'status' });
  const generate = h('button', { type: 'button', class: 'btn btn-primary' }, icon('download'), 'Descargar PDF');

  const currentFilters = () => ({
    ...EMPTY_FILTERS,
    categoryId: category.value,
    locationId: place.value,
    condition: condition.value,
  });
  const selection = () => sortAssets(filterAssets(assetStore.getAll(), currentFilters(), catalogLookups), 'name:asc');
  const describeFilters = () => {
    const parts = [
      category.value ? `Departamento: ${catalogLookups.categoryName(category.value)}` : '',
      place.value ? `Ubicación: ${catalogLookups.locationName(place.value)}` : '',
      condition.value ? `Estado: ${CONDITIONS[condition.value]}` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Todos los bienes';
  };
  const updatePreview = () => {
    const count = selection().length;
    preview.textContent = `El reporte incluirá ${formatNumber(count)} bien${count === 1 ? '' : 'es'}.`;
    generate.disabled = count === 0;
  };

  [category, place, condition].forEach((control) => control.addEventListener('change', updatePreview));

  generate.addEventListener('click', async () => {
    generate.disabled = true;
    try {
      await generateInventoryPdf({
        assets: selection(),
        lookups: catalogLookups,
        filterSummary: describeFilters(),
        generatedBy: session.profile.displayName,
      });
      notify.success('Reporte descargado.');
    } catch (error) {
      handleError(error, 'pdf report');
    } finally {
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
      h('p', { class: 'muted field--wide' }, 'Incluye detalle de cada bien, ubicación, estado y valor, con un resumen al inicio.'),
      field({ label: 'Departamento', name: 'categoryId', control: category }),
      field({ label: 'Ubicación', name: 'locationId', control: place }),
      field({ label: 'Estado', name: 'condition', control: condition }),
      h('div', { class: 'field--wide stack' }, preview, h('div', { class: 'button-row' }, generate)),
    ),
  );
  updatePreview();
  const unsubscribe = assetStore.subscribe(updatePreview);
  return unsubscribe;
}
