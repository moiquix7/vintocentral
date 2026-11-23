/**
 * Inventory PDF report (jsPDF + AutoTable, loaded on demand from cdnjs only when a report is generated).
 */
import { APP, CONDITIONS } from '../../config/app-config.js';
import { AppError } from '../../core/errors.js';
import { loadScript } from '../../shared/script-loader.js';
import { formatCurrency, formatDateTime, formatNumber, todayIso } from '../../shared/format.js';
import { computeStats } from '../dashboard/dashboard.stats.js';

const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const AUTOTABLE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';

const COLORS = Object.freeze({ primary: [47, 111, 126], text: [43, 47, 51], muted: [93, 100, 107], stripe: [244, 246, 243] });

async function loadPdfLibrary() {
  await loadScript(JSPDF_URL);
  await loadScript(AUTOTABLE_URL);
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF || typeof jsPDF.API?.autoTable !== 'function') {
    throw new AppError('No se pudo preparar el generador de PDF.', { code: 'app/pdf' });
  }
  return jsPDF;
}

/** Table rows for the report. Pure helper. */
export function buildReportRows(assets, lookups) {
  return assets.map((asset) => [
    asset.code || '—',
    asset.name,
    lookups.categoryName(asset.categoryId),
    lookups.locationName(asset.locationId),
    CONDITIONS[asset.condition] ?? '—',
    formatNumber(asset.quantity),
    formatCurrency(asset.value),
    formatCurrency((asset.value || 0) * (asset.quantity || 1)),
  ]);
}

/**
 * @param {{ assets: object[], lookups: object, filterSummary: string, generatedBy: string }} input
 */
export async function generateInventoryPdf({ assets, lookups, filterSummary, generatedBy }) {
  const jsPDF = await loadPdfLibrary();
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const stats = computeStats(assets, lookups);
  const pageWidth = pdf.internal.pageSize.getWidth();

  pdf.setTextColor(...COLORS.primary);
  pdf.setFontSize(16);
  pdf.text('Informe de inventario de bienes', 14, 16);
  pdf.setFontSize(10);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(APP.name, 14, 22);
  pdf.text(`Generado: ${formatDateTime(new Date())} por ${generatedBy}`, 14, 27);
  pdf.text(`Filtros: ${filterSummary}`, 14, 32);

  pdf.setTextColor(...COLORS.text);
  pdf.setFontSize(11);
  const conditions = stats.byCondition.filter((c) => c.units > 0).map((c) => `${c.label}: ${formatNumber(c.units)}`).join('   ');
  pdf.text(
    `Bienes: ${formatNumber(stats.totalRecords)}    Unidades: ${formatNumber(stats.totalUnits)}    Valor total: ${formatCurrency(stats.totalValue)}`,
    14,
    40,
  );
  if (conditions) pdf.text(`Por estado (unidades) — ${conditions}`, 14, 46);

  pdf.autoTable({
    startY: 51,
    head: [['Código', 'Nombre', 'Departamento', 'Ubicación', 'Estado', 'Cant.', 'Valor unit.', 'Valor total']],
    body: buildReportRows(assets, lookups),
    styles: { fontSize: 9, cellPadding: 2, textColor: COLORS.text },
    headStyles: { fillColor: COLORS.primary, textColor: 255 },
    alternateRowStyles: { fillColor: COLORS.stripe },
    columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
    margin: { left: 14, right: 14, bottom: 16 },
    didDrawPage: () => {
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.setFontSize(8);
      pdf.setTextColor(...COLORS.muted);
      pdf.text(`Página ${pdf.internal.getNumberOfPages()}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
    },
  });

  pdf.save(`inventario-${todayIso()}.pdf`);
}
