/**
 * Inventory PDF report (jsPDF + AutoTable, loaded on demand from cdnjs only when a report is generated).
 * Design (CLAUDE.md "REPORT DESIGN"), A4 landscape, minimalist:
 *   header   — left: title, department, report date, reported by · right: church name + logo
 *   table    — [Foto], Fecha de adquisición, Artículo, Marca, Modelo, Nro. de serie, Cantidad, Estado
 *   end      — three signature lines: Anciano del Departamento, Líder entrante, Líder saliente
 *   footer   — generation date and "Página X de Y" on every page
 * Optionally includes the first photo of each asset: downloaded 4 at a time, cropped to a small
 * square JPEG and drawn in the first column. A photo (or the logo) that fails never stops the report.
 */
import { APP, CONDITIONS } from '../../config/app-config.js';
import { AppError } from '../../core/errors.js';
import { loadScript } from '../../shared/script-loader.js';
import { loadSquareThumbnail } from '../../shared/image.js';
import { mapWithConcurrency } from '../../shared/async.js';
import { formatDate, formatDateTime, formatNumber, todayIso } from '../../shared/format.js';

const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const AUTOTABLE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';

const REPORT_TITLE = 'Inventario de activos fijos';
export const REPORT_COLUMNS = Object.freeze(['Fecha de adquisición', 'Artículo', 'Marca', 'Modelo', 'Nro. de serie', 'Cantidad', 'Estado']);
export const SIGNATURES = Object.freeze(['Anciano del Departamento', 'Líder entrante', 'Líder saliente']);

const COLORS = Object.freeze({
  primary: [47, 111, 126],
  text: [43, 47, 51],
  muted: [93, 100, 107],
  headFill: [227, 239, 241],
  rule: [217, 222, 214],
});
const PAGE = Object.freeze({ margin: 14, footerY: 8, logoHeightMm: 18 });
const PHOTO = Object.freeze({ sizeMm: 16, cellMm: 19, columnMm: 20, downloads: 4 });
const SIGN = Object.freeze({ gapAboveMm: 28, lineMm: 65, blockMm: 18 });

async function loadPdfLibrary() {
  await loadScript(JSPDF_URL);
  await loadScript(AUTOTABLE_URL);
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF || typeof jsPDF.API?.autoTable !== 'function') {
    throw new AppError('No se pudo preparar el generador de PDF.', { code: 'app/pdf' });
  }
  return jsPDF;
}

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

/** The church logo (same origin) as a PNG data URL with its aspect ratio, or null if it cannot be loaded. */
async function loadLogo() {
  try {
    const image = new Image();
    image.src = APP.logo;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return { data: canvas.toDataURL('image/png'), ratio: image.naturalWidth / image.naturalHeight };
  } catch (error) {
    console.warn('[VintoCentral] report logo skipped', error);
    return null;
  }
}

/** Left: title, department, date, reported by (+ other filters). Right: church name and logo. Returns the bottom y. */
function drawHeader(pdf, { department, filterSummary, generatedBy, logo }) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const left = PAGE.margin;
  const right = pageWidth - PAGE.margin;

  let textRight = right;
  if (logo) {
    const width = PAGE.logoHeightMm * logo.ratio;
    pdf.addImage(logo.data, 'PNG', right - width, 10, width, PAGE.logoHeightMm);
    textRight = right - width - 4;
  }
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(...COLORS.text);
  pdf.text(pdf.splitTextToSize(APP.churchFullName, 85), textRight, 16, { align: 'right' });
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(APP.systemName, textRight, 27, { align: 'right' });

  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(...COLORS.primary);
  pdf.text(REPORT_TITLE, left, 16);
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(...COLORS.text);
  const lines = [
    `Departamento: ${department}`,
    `Fecha del reporte: ${formatDate(todayIso())}`,
    `Reportado por: ${generatedBy}`,
  ];
  lines.forEach((line, index) => pdf.text(line, left, 23 + index * 5));
  let bottom = 23 + (lines.length - 1) * 5;
  if (filterSummary) {
    pdf.setFontSize(9);
    pdf.setTextColor(...COLORS.muted);
    bottom += 5;
    pdf.text(`Filtros: ${filterSummary}`, left, bottom);
  }

  bottom += 4;
  pdf.setDrawColor(...COLORS.rule);
  pdf.setLineWidth(0.3);
  pdf.line(left, bottom, right, bottom);
  return bottom;
}

/** Three signature lines after the table; on a new page when they do not fit. */
function drawSignatures(pdf, afterY) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let y = afterY + SIGN.gapAboveMm;
  if (y + SIGN.blockMm > pageHeight - PAGE.margin - PAGE.footerY) {
    pdf.addPage();
    y = PAGE.margin + SIGN.gapAboveMm;
  }
  const slot = (pageWidth - PAGE.margin * 2) / SIGNATURES.length;
  pdf.setDrawColor(...COLORS.muted);
  pdf.setLineWidth(0.3);
  pdf.setFontSize(10);
  pdf.setTextColor(...COLORS.text);
  SIGNATURES.forEach((label, index) => {
    const center = PAGE.margin + slot * index + slot / 2;
    pdf.line(center - SIGN.lineMm / 2, y, center + SIGN.lineMm / 2, y);
    pdf.text(label, center, y + 5, { align: 'center' });
  });
}

/** Generation date (left) and "Página X de Y" (right) on every page. */
function drawFooters(pdf, generatedAt) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const total = pdf.internal.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(`Generado el ${generatedAt}`, PAGE.margin, pageHeight - PAGE.footerY);
    pdf.text(`Página ${page} de ${total}`, pageWidth - PAGE.margin, pageHeight - PAGE.footerY, { align: 'right' });
  }
}

/**
 * @param {{
 *   assets: object[], department: string, filterSummary: string, generatedBy: string,
 *   includePhotos?: boolean, onProgress?: (done: number, total: number) => void
 * }} input
 *   department: department name, or "Todos los departamentos"; filterSummary: the other filters ('' = none)
 * @returns {Promise<{ failedPhotos: number, blockedPhotos: number, totalPhotos: number }>}
 */
export async function generateInventoryPdf({ assets, department, filterSummary, generatedBy, includePhotos = false, onProgress }) {
  const jsPDF = await loadPdfLibrary();
  const photos = includePhotos ? await collectPhotos(assets, onProgress) : { images: [], failed: 0, blocked: 0, withPhoto: 0 };
  const logo = await loadLogo();

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const headerBottom = drawHeader(pdf, { department, filterSummary, generatedBy, logo });

  const head = [...REPORT_COLUMNS];
  let body = buildReportRows(assets);
  const offset = includePhotos ? 1 : 0;
  if (includePhotos) {
    head.unshift('Foto');
    body = body.map((row, index) => [photos.images[index] ? '' : '—', ...row]);
  }

  pdf.autoTable({
    startY: headerBottom + 5,
    head: [head],
    body,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 2.2,
      textColor: COLORS.text,
      valign: 'middle',
      lineColor: COLORS.rule,
      lineWidth: { bottom: 0.2 },
      minCellHeight: includePhotos ? PHOTO.cellMm : 0,
    },
    headStyles: { fillColor: COLORS.headFill, textColor: COLORS.primary, fontStyle: 'bold', minCellHeight: 0 },
    columnStyles: {
      ...(includePhotos ? { 0: { cellWidth: PHOTO.columnMm, halign: 'center' } } : {}),
      [0 + offset]: { cellWidth: 30 },
      [1 + offset]: { cellWidth: 'auto', fontStyle: 'bold' },
      [5 + offset]: { halign: 'right', cellWidth: 20 },
    },
    margin: { left: PAGE.margin, right: PAGE.margin, top: PAGE.margin, bottom: PAGE.margin + PAGE.footerY },
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

  drawSignatures(pdf, pdf.lastAutoTable.finalY);
  drawFooters(pdf, formatDateTime(new Date()));

  pdf.save(`inventario-${todayIso()}.pdf`);
  return { failedPhotos: photos.failed, blockedPhotos: photos.blocked, totalPhotos: photos.withPhoto };
}
