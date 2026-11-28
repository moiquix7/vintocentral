/**
 * "Informe de toma de inventario" PDF (common design in report-layout.js):
 *   summary    — round start date, verified N de M (P %), pending, proposed actions by type
 *   table      — Artículo, Cantidad, Ubicación, Estado, Disponibilidad, Verificado, Acción propuesta, Observaciones
 *   signatures — the signed-in user (name printed) and one left blank
 * Rows and summary are pure helpers (tested); only generateTakingReportPdf touches the browser.
 */
import { AVAILABILITY, CONDITIONS, PROPOSED_ACTIONS } from '../../config/app-config.js';
import { formatDate, formatDateTime, formatNumber, todayIso } from '../../shared/format.js';
import { availabilityOf, isUnavailable, proposedActionOf } from '../assets/asset.model.js';
import { inventoryProgress, isChecked, proposedActionCounts } from '../inventory/inventory.model.js';
import { COLORS, PAGE, baseTableOptions, drawFooters, drawHeader, drawSignatures, loadLogo, loadPdfLibrary, newDocument } from './report-layout.js';

const REPORT_TITLE = 'Toma de inventario';
export const TAKING_COLUMNS = Object.freeze(['Artículo', 'Cantidad', 'Ubicación', 'Estado', 'Disponibilidad', 'Verificado', 'Acción propuesta', 'Observaciones']);
export const PENDING_TEXT = 'Pendiente';
const VERIFIED_COLUMN = TAKING_COLUMNS.indexOf('Verificado');

/** Two signatures: whoever generates the report (name printed) and one left blank. */
export function takingSignatures(userName) {
  return [{ label: 'Responsable de la toma de inventario', name: userName }, { label: 'Nombre y firma' }];
}

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** "Reparar — cambiar el cable", only the action, only the comment, or "—". */
function proposalText(asset) {
  const action = PROPOSED_ACTIONS[proposedActionOf(asset)] ?? '';
  const note = text(asset.proposedActionNote);
  if (action && note) return `${action} — ${note}`;
  return action || note || '—';
}

/** "Motivo: …" (only while not available) and the notes, one per line, or "—". */
function remarksText(asset) {
  const reason = isUnavailable(availabilityOf(asset)) ? text(asset.unavailableReason) : '';
  return [reason ? `Motivo: ${reason}` : '', text(asset.notes)].filter(Boolean).join('\n') || '—';
}

/**
 * Table rows in TAKING_COLUMNS order. Pure helper.
 * @param {string} roundStart YYYY-MM-DD: verified = checkedAt on or after that day
 * @param {{ locationName: (id: string) => string }} lookups
 */
export function buildTakingRows(assets, roundStart, lookups) {
  return assets.map((asset) => [
    asset.code ? `${asset.name} (${asset.code})` : asset.name,
    formatNumber(asset.quantity),
    lookups.locationName(asset.locationId),
    CONDITIONS[asset.condition] ?? '—',
    AVAILABILITY[availabilityOf(asset)],
    isChecked(asset, roundStart) ? formatDateTime(asset.checkedAt) : PENDING_TEXT,
    proposalText(asset),
    remarksText(asset),
  ]);
}

/**
 * Summary lines printed under the header. Pure helper.
 * @returns {string[]}
 */
export function takingSummaryLines(assets, roundStart) {
  const progress = inventoryProgress(assets, roundStart);
  const { byAction, commentOnly } = proposedActionCounts(assets);
  const actions = byAction.map(({ label, count }) => `${label}: ${formatNumber(count)}`);
  if (commentOnly) actions.push(`Solo comentario: ${formatNumber(commentOnly)}`);
  return [
    `Inventario iniciado el ${formatDate(roundStart)} · Verificados: ${formatNumber(progress.checked)} de ${formatNumber(progress.total)} (${progress.percent} %) · Pendientes: ${formatNumber(progress.total - progress.checked)}`,
    `Acciones propuestas: ${actions.length ? actions.join(' · ') : 'ninguna'}`,
  ];
}

/** Summary block under the header; returns the y where the table may start. */
function drawSummary(pdf, lines, top) {
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(...COLORS.text);
  const width = pdf.internal.pageSize.getWidth() - PAGE.margin * 2;
  let y = top;
  for (const line of lines) {
    const wrapped = pdf.splitTextToSize(line, width);
    pdf.text(wrapped, PAGE.margin, y);
    y += wrapped.length * 5;
  }
  return y;
}

/**
 * @param {{ assets: object[], roundStart: string, department: string, filterSummary: string, generatedBy: string,
 *   lookups: { locationName: (id: string) => string } }} input
 */
export async function generateTakingReportPdf({ assets, roundStart, department, filterSummary, generatedBy, lookups }) {
  const jsPDF = await loadPdfLibrary();
  const logo = await loadLogo();

  const pdf = newDocument(jsPDF);
  const headerBottom = drawHeader(pdf, {
    title: REPORT_TITLE,
    department,
    generatedBy,
    extraLine: filterSummary ? `Filtros: ${filterSummary}` : '',
    logo,
  });
  const tableTop = drawSummary(pdf, takingSummaryLines(assets, roundStart), headerBottom + 7);

  pdf.autoTable({
    ...baseTableOptions(tableTop + 1),
    head: [[...TAKING_COLUMNS]],
    body: buildTakingRows(assets, roundStart, lookups),
    columnStyles: {
      0: { cellWidth: 'auto', fontStyle: 'bold' },
      1: { halign: 'right', cellWidth: 18 },
      5: { cellWidth: 30 },
      6: { cellWidth: 45 },
      7: { cellWidth: 50 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === VERIFIED_COLUMN && data.cell.raw === PENDING_TEXT) {
        data.cell.styles.textColor = COLORS.muted;
        data.cell.styles.fontStyle = 'italic';
      }
    },
  });

  drawSignatures(pdf, pdf.lastAutoTable.finalY, takingSignatures(generatedBy));
  drawFooters(pdf, formatDateTime(new Date()));
  pdf.save(`toma-de-inventario-${todayIso()}.pdf`);
}
