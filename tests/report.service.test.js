import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPORT_COLUMNS, SIGNATURES, buildReportRows } from '../js/modules/reports/report.service.js';

test('report columns follow CLAUDE.md "REPORT DESIGN"', () => {
  assert.deepEqual(REPORT_COLUMNS, ['Fecha de adquisición', 'Artículo', 'Marca', 'Modelo', 'Nro. de serie', 'Cantidad', 'Estado']);
  assert.deepEqual(SIGNATURES, ['Anciano del Departamento', 'Líder entrante', 'Líder saliente']);
});

test('report rows: one value per column, "—" for missing data', () => {
  const [full, old] = buildReportRows([
    { name: 'Consola', acquisitionDate: '2024-03-15', brand: 'Yamaha', model: ' MG10XU ', serialNumber: 'SN-1', quantity: 2, condition: 'good' },
    { name: 'Banca', quantity: 40, condition: 'fair' },
  ]);
  assert.equal(full.length, REPORT_COLUMNS.length);
  assert.notEqual(full[0], '—', 'acquisition date is formatted');
  assert.deepEqual(full.slice(1), ['Consola', 'Yamaha', 'MG10XU', 'SN-1', '2', 'Bueno']);
  assert.deepEqual(old, ['—', 'Banca', '—', '—', '—', '40', 'Regular']);
});
