import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReportRows, equipmentText } from '../js/modules/reports/report.service.js';

const lookups = {
  typeName: () => 'Equipo de sonido',
  categoryName: () => 'Música',
  locationName: () => 'Templo',
};

test('equipmentText: one labelled line per present value, "—" when none', () => {
  assert.equal(equipmentText({ brand: 'Yamaha', model: ' MG10XU ', serialNumber: 'SN-1' }), 'Marca: Yamaha\nModelo: MG10XU\nSerie: SN-1');
  assert.equal(equipmentText({ brand: '', model: 'MG10XU' }), 'Modelo: MG10XU');
  assert.equal(equipmentText({}), '—', 'articles registered before these fields existed');
});

test('report rows put marca / modelo / serie right after the name', () => {
  const [row] = buildReportRows([{ code: 'MIX-1', name: 'Consola', brand: 'Yamaha', condition: 'good', quantity: 1, value: 0 }], lookups);
  assert.equal(row.length, 11);
  assert.deepEqual(row.slice(0, 4), ['MIX-1', 'Consola', 'Marca: Yamaha', 'Equipo de sonido']);
});
