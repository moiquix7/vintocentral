/**
 * "Informe de artículos" PDF (common design in report-layout.js):
 *   table      — [Foto], Fecha de adquisición, Artículo, Marca, Modelo, Nro. de serie, Cantidad, Estado
 *   signatures — Anciano del Departamento, Líder entrante, Líder saliente
 * Optionally includes the first photo of each asset: downloaded 4 at a time, cropped to a small
 * square JPEG and drawn in the first column. A photo (or the logo) that fails never stops the report.
 */
import { CONDITIONS } from '../../config/app-config.js';
import { loadSquareThumbnail } from '../../shared/image.js';
import { mapWithConcurrency } from '../../shared/async.js';
import { formatDate, formatDateTime, formatNumber, todayIso } from '../../shared/format.js';
import { baseTableOptions, drawFooters, drawHeader, drawSignatures, loadLogo, loadPdfLibrary, newDocument } from './report-layout.js';

const REPORT_TITLE = 'Inventario de activos fijos';
export const REPORT_COLUMNS = Object.freeze(['Fecha de adquisición', 'Artículo', 'Marca', 'Modelo', 'Nro. de serie', 'Cantidad', 'Estado']);
export const SIGNATURES = Object.freeze(['Anciano del Departamento', 'Líder entrante', 'Líder saliente']);

const PHOTO = Object.freeze({ sizeMm: 16, cellMm: 19, columnMm: 20, downloads: 4 });

const orDash = (value) => (typeof value === 'string' && value.trim() ? value.trim() : '—');

/** Table rows for the report (without the photo column), in REPORT_COLUMNS order. Pure helper. */
export function buildReportRows(assets) {
  return assets.map((asset) => [
    asset.acquisitionDate ? formatDate(asset.acquisitionDate) : '—',
    asset.name,
    orDash(asset.brand),
    orDash(asset.model),
    orDash(asset.serialNumber),
    formatNumber(asset.quantity),
    CONDITIONS[asset.condition] ?? '—',
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
 *   assets: object[], department: string, filterSummary: string, generatedBy: string,
 *   includePhotos?: boolean, onProgress?: (done: number, total: number) => void
 * }} input
 *   department: department name, or "Todos los departamentos"; filterSummary: the other filters ('' = none)
 * @returns {Promise<{ failedPhotos: number, blockedPhotos: number, totalPhotos: number }>}
 */
export async function generateAssetReportPdf({ assets, department, filterSummary, generatedBy, includePhotos = false, onProgress }) {
  const jsPDF = await loadPdfLibrary();
  const photos = includePhotos ? await collectPhotos(assets, onProgress) : { images: [], failed: 0, blocked: 0, withPhoto: 0 };
  const logo = await loadLogo();

  const pdf = newDocument(jsPDF);
  const headerBottom = drawHeader(pdf, {
    title: REPORT_TITLE,
    department,
    generatedBy,
    extraLine: filterSummary ? `Filtros: ${filterSummary}` : '',
    logo,
  });

  const head = [...REPORT_COLUMNS];
  let body = buildReportRows(assets);
  const offset = includePhotos ? 1 : 0;
  if (includePhotos) {
    head.unshift('Foto');
    body = body.map((row, index) => [photos.images[index] ? '' : '—', ...row]);
  }

  const base = baseTableOptions(headerBottom + 5);
  pdf.autoTable({
    ...base,
    head: [head],
    body,
    styles: { ...base.styles, minCellHeight: includePhotos ? PHOTO.cellMm : 0 },
    columnStyles: {
      ...(includePhotos ? { 0: { cellWidth: PHOTO.columnMm, halign: 'center' } } : {}),
      [0 + offset]: { cellWidth: 30 },
      [1 + offset]: { cellWidth: 'auto', fontStyle: 'bold' },
      [5 + offset]: { halign: 'right', cellWidth: 20 },
    },
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
  });

  drawSignatures(pdf, pdf.lastAutoTable.finalY, SIGNATURES.map((label) => ({ label })));
  drawFooters(pdf, formatDateTime(new Date()));

  pdf.save(`inventario-${todayIso()}.pdf`);
  return { failedPhotos: photos.failed, blockedPhotos: photos.blocked, totalPhotos: photos.withPhoto };
}
