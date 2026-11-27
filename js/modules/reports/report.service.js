/**
 * Inventory PDF report (jsPDF + AutoTable, loaded on demand from cdnjs only when a report is generated).
 * Optionally includes the first photo of each asset: downloaded 4 at a time, cropped to a small
 * square JPEG and drawn in the first column. A photo that fails never stops the report.
 */
import { APP, AVAILABILITY, CONDITIONS } from '../../config/app-config.js';
import { availabilityOf } from '../assets/asset.model.js';
import { AppError } from '../../core/errors.js';
import { loadScript } from '../../shared/script-loader.js';
import { loadSquareThumbnail } from '../../shared/image.js';
import { mapWithConcurrency } from '../../shared/async.js';
import { formatCurrency, formatDateTime, formatNumber, todayIso } from '../../shared/format.js';
import { computeStats } from '../dashboard/dashboard.stats.js';

const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const AUTOTABLE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';

const COLORS = Object.freeze({ primary: [47, 111, 126], text: [43, 47, 51], muted: [93, 100, 107], stripe: [244, 246, 243] });
const PHOTO = Object.freeze({ sizeMm: 16, cellMm: 19, columnMm: 20, downloads: 4 });

async function loadPdfLibrary() {
  await loadScript(JSPDF_URL);
  await loadScript(AUTOTABLE_URL);
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF || typeof jsPDF.API?.autoTable !== 'function') {
    throw new AppError('No se pudo preparar el generador de PDF.', { code: 'app/pdf' });
  }
  return jsPDF;
}

/** Table rows for the report (without the photo column). Pure helper. */
export function buildReportRows(assets, lookups) {
  return assets.map((asset) => [
    asset.code || '—',
    asset.name,
    lookups.typeName(asset.typeId),
    lookups.categoryName(asset.categoryId),
    lookups.locationName(asset.locationId),
    CONDITIONS[asset.condition] ?? '—',
    AVAILABILITY[availabilityOf(asset)],
    formatNumber(asset.quantity),
    formatCurrency(asset.value),
    formatCurrency((asset.value || 0) * (asset.quantity || 1)),
  ]);
}

/**
 * Downloads the first photo of every asset that has one.
 * `blocked` counts downloads refused by the browser (missing CORS on the bucket).
 * @returns {Promise<{ images: Array<string|null>, failed: number, blocked: number, withPhoto: number }>}
 */
async function collectPhotos(assets, onProgress) {
  const withPhoto = assets.filter((asset) => asset.photos?.[0]?.url).length;
  let done = 0;
  let failed = 0;
  let blocked = 0;
  onProgress?.(0, withPhoto);
  const images = await mapWithConcurrency(assets, PHOTO.downloads, async (asset) => {
    const url = asset.photos?.[0]?.url;
    if (!url) return null;
    try {
      return await loadSquareThumbnail(url);
    } catch (error) {
      failed += 1;
      if (error?.code === 'app/image-blocked') blocked += 1;
      console.warn('[VintoCentral] report photo skipped', asset.id, error?.code, error?.cause ?? error);
      return null;
    } finally {
      onProgress?.(++done, withPhoto);
    }
  });
  return { images, failed, blocked, withPhoto };
}

/**
 * @param {{
 *   assets: object[], lookups: object, filterSummary: string, generatedBy: string,
 *   includePhotos?: boolean, onProgress?: (done: number, total: number) => void
 * }} input
 * @returns {Promise<{ failedPhotos: number, blockedPhotos: number, totalPhotos: number }>}
 */
export async function generateInventoryPdf({ assets, lookups, filterSummary, generatedBy, includePhotos = false, onProgress }) {
  const jsPDF = await loadPdfLibrary();
  const photos = includePhotos ? await collectPhotos(assets, onProgress) : { images: [], failed: 0, blocked: 0, withPhoto: 0 };

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const stats = computeStats(assets, lookups);
  const pageWidth = pdf.internal.pageSize.getWidth();

  pdf.setTextColor(...COLORS.primary);
  pdf.setFontSize(16);
  pdf.text('Informe de inventario de artículos', 14, 16);
  pdf.setFontSize(10);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(APP.name, 14, 22);
  pdf.text(`Generado: ${formatDateTime(new Date())} por ${generatedBy}`, 14, 27);
  pdf.text(`Filtros: ${filterSummary}`, 14, 32);

  pdf.setTextColor(...COLORS.text);
  pdf.setFontSize(11);
  const conditions = stats.byCondition.filter((c) => c.units > 0).map((c) => `${c.label}: ${formatNumber(c.units)}`).join('   ');
  pdf.text(
    `Artículos: ${formatNumber(stats.totalRecords)}    Unidades: ${formatNumber(stats.totalUnits)}    Valor total: ${formatCurrency(stats.totalValue)}`,
    14,
    40,
  );
  if (conditions) pdf.text(`Por estado (unidades) — ${conditions}`, 14, 46);

  const head = ['Código', 'Nombre', 'Categoría', 'Departamento', 'Ubicación', 'Estado', 'Disponib.', 'Cant.', 'Valor unit.', 'Valor total'];
  let body = buildReportRows(assets, lookups);
  const offset = includePhotos ? 1 : 0;
  if (includePhotos) {
    head.unshift('Foto');
    body = body.map((row, index) => [photos.images[index] ? '' : '—', ...row]);
  }
  const right = { halign: 'right' };

  pdf.autoTable({
    startY: 51,
    head: [head],
    body,
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      textColor: COLORS.text,
      valign: 'middle',
      minCellHeight: includePhotos ? PHOTO.cellMm : 0,
    },
    headStyles: { fillColor: COLORS.primary, textColor: 255, minCellHeight: 0 },
    alternateRowStyles: { fillColor: COLORS.stripe },
    columnStyles: {
      ...(includePhotos ? { 0: { cellWidth: PHOTO.columnMm, halign: 'center' } } : {}),
      [7 + offset]: right,
      [8 + offset]: right,
      [9 + offset]: right,
    },
    margin: { left: 14, right: 14, bottom: 16 },
    didDrawCell: (data) => {
      if (!includePhotos || data.section !== 'body' || data.column.index !== 0) return;
      const image = photos.images[data.row.index];
      if (!image) return;
      const x = data.cell.x + (data.cell.width - PHOTO.sizeMm) / 2;
      const y = data.cell.y + (data.cell.height - PHOTO.sizeMm) / 2;
      try {
        pdf.addImage(image, 'JPEG', x, y, PHOTO.sizeMm, PHOTO.sizeMm);
      } catch (error) {
        console.warn('[VintoCentral] photo could not be drawn', error);
      }
    },
    didDrawPage: () => {
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.setFontSize(8);
      pdf.setTextColor(...COLORS.muted);
      pdf.text(`Página ${pdf.internal.getNumberOfPages()}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
    },
  });

  pdf.save(`inventario-${todayIso()}.pdf`);
  return { failedPhotos: photos.failed, blockedPhotos: photos.blocked, totalPhotos: photos.withPhoto };
}
