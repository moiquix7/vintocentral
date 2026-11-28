/**
 * Common PDF design shared by every report (CLAUDE.md "REPORT DESIGN"), A4 landscape, minimalist:
 *   header     — left: title, department, report date, reported by (+ muted extra line) · right: church name + logo
 *   signatures — lines after the table (on a new page when they do not fit)
 *   footer     — generation date and "Página X de Y" on every page
 * jsPDF + AutoTable are loaded on demand from cdnjs only when a report is generated.
 */
import { APP } from '../../config/app-config.js';
import { AppError } from '../../core/errors.js';
import { loadScript } from '../../shared/script-loader.js';
import { formatDate, todayIso } from '../../shared/format.js';

const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const AUTOTABLE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';

export const COLORS = Object.freeze({
  primary: [47, 111, 126],
  text: [43, 47, 51],
  muted: [93, 100, 107],
  headFill: [227, 239, 241],
  rule: [217, 222, 214],
});
export const PAGE = Object.freeze({ margin: 14, footerY: 8, logoHeightMm: 18 });
const SIGN = Object.freeze({ gapAboveMm: 28, lineMm: 65, blockMm: 22 });

/** Minimalist table style shared by the reports (plain theme, soft header, thin row separators). */
export function baseTableOptions(startY) {
  return {
    startY,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 2.2,
      textColor: COLORS.text,
      valign: 'middle',
      lineColor: COLORS.rule,
      lineWidth: { bottom: 0.2 },
    },
    headStyles: { fillColor: COLORS.headFill, textColor: COLORS.primary, fontStyle: 'bold', minCellHeight: 0 },
    margin: { left: PAGE.margin, right: PAGE.margin, top: PAGE.margin, bottom: PAGE.margin + PAGE.footerY },
  };
}

export async function loadPdfLibrary() {
  await loadScript(JSPDF_URL);
  await loadScript(AUTOTABLE_URL);
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF || typeof jsPDF.API?.autoTable !== 'function') {
    throw new AppError('No se pudo preparar el generador de PDF.', { code: 'app/pdf' });
  }
  return jsPDF;
}

/** A new A4 landscape document. */
export function newDocument(jsPDF) {
  return new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
}

/** The church logo (same origin) as a PNG data URL with its aspect ratio, or null if it cannot be loaded. */
export async function loadLogo() {
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

/**
 * Left: title, department, date, reported by (+ an optional muted line). Right: church name and logo.
 * @param {{ title: string, department: string, generatedBy: string, extraLine?: string, logo: object|null }} header
 * @returns {number} the y of the separator line under the header
 */
export function drawHeader(pdf, { title, department, generatedBy, extraLine = '', logo }) {
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
  pdf.text(title, left, 16);
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(...COLORS.text);
  const lines = [`Departamento: ${department}`, `Fecha del reporte: ${formatDate(todayIso())}`, `Reportado por: ${generatedBy}`];
  lines.forEach((line, index) => pdf.text(line, left, 23 + index * 5));
  let bottom = 23 + (lines.length - 1) * 5;
  if (extraLine) {
    pdf.setFontSize(9);
    pdf.setTextColor(...COLORS.muted);
    bottom += 5;
    pdf.text(extraLine, left, bottom);
  }

  bottom += 4;
  pdf.setDrawColor(...COLORS.rule);
  pdf.setLineWidth(0.3);
  pdf.line(left, bottom, right, bottom);
  return bottom;
}

/**
 * Signature lines after the table, evenly spread; on a new page when they do not fit.
 * Each slot: the line, then the person's name (bold, when known) and the caption below it.
 * @param {Array<{ label: string, name?: string }>} signatures
 */
export function drawSignatures(pdf, afterY, signatures) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let y = afterY + SIGN.gapAboveMm;
  if (y + SIGN.blockMm > pageHeight - PAGE.margin - PAGE.footerY) {
    pdf.addPage();
    y = PAGE.margin + SIGN.gapAboveMm;
  }
  const slot = (pageWidth - PAGE.margin * 2) / signatures.length;
  pdf.setDrawColor(...COLORS.muted);
  pdf.setLineWidth(0.3);
  signatures.forEach(({ label, name }, index) => {
    const center = PAGE.margin + slot * index + slot / 2;
    pdf.line(center - SIGN.lineMm / 2, y, center + SIGN.lineMm / 2, y);
    let textY = y + 5;
    if (name) {
      pdf.setFont(undefined, 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...COLORS.text);
      pdf.text(name, center, textY, { align: 'center' });
      textY += 5;
    }
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(name ? 9 : 10);
    pdf.setTextColor(...(name ? COLORS.muted : COLORS.text));
    pdf.text(label, center, textY, { align: 'center' });
  });
}

/** Generation date (left) and "Página X de Y" (right) on every page. */
export function drawFooters(pdf, generatedAt) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const total = pdf.internal.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    pdf.setPage(page);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(`Generado el ${generatedAt}`, PAGE.margin, pageHeight - PAGE.footerY);
    pdf.text(`Página ${page} de ${total}`, pageWidth - PAGE.margin, pageHeight - PAGE.footerY, { align: 'right' });
  }
}
