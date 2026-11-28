import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAKING_COLUMNS, PENDING_TEXT, buildTakingRows, takingSignatures, takingSummaryLines } from '../js/modules/reports/taking-report.service.js';
import { filterByAction, hasProposal, proposedActionCounts } from '../js/modules/inventory/inventory.model.js';
import { sanitizeInventoryUpdate, validateInventoryUpdate } from '../js/modules/assets/asset.model.js';
import { describeValue, diffAssets } from '../js/modules/history/history.model.js';

const lookups = { typeName: (id) => `type-${id}`, categoryName: (id) => `cat-${id}`, locationName: (id) => `loc-${id}` };
const checked = new Date(2026, 10, 20, 10);
const assets = [
  {
    id: '1',
    name: 'Consola',
    code: 'SON-1',
    quantity: 1,
    locationId: 'l1',
    condition: 'poor',
    availability: 'in_repair',
    unavailableReason: 'En el taller',
    notes: 'Canal 3 sin sonido',
    proposedAction: 'repair',
    proposedActionNote: 'Cambiar el fader',
    checkedAt: checked,
  },
  { id: '2', name: 'Banca', quantity: 40, locationId: 'l2', condition: 'good', proposedActionNote: 'Barnizar' },
  { id: '3', name: 'Mesa', quantity: 2, locationId: 'l2', condition: 'out_of_service', proposedAction: 'dispose', checkedAt: checked },
];

test('inventory-taking report: one value per column, pending and proposals described', () => {
  const [consola, banca, mesa] = buildTakingRows(assets, '2026-11-01', lookups);
  assert.equal(consola.length, TAKING_COLUMNS.length);
  assert.deepEqual(consola.slice(0, 5), ['Consola (SON-1)', '1', 'loc-l1', 'Malo', 'En reparación']);
  assert.notEqual(consola[5], PENDING_TEXT);
  assert.equal(consola[6], 'Reparar — Cambiar el fader');
  assert.equal(consola[7], 'Motivo: En el taller\nCanal 3 sin sonido');
  assert.deepEqual(banca.slice(4), ['Disponible', PENDING_TEXT, 'Barnizar', '—']);
  assert.equal(mesa[6], 'Colocar de baja');
  assert.equal(buildTakingRows(assets, '2026-11-21', lookups)[0][5], PENDING_TEXT, 'checked before the round = pending');
});

test('inventory-taking summary and signatures', () => {
  const [progress, actions] = takingSummaryLines(assets, '2026-11-01');
  assert.match(progress, /Verificados: 2 de 3 \(66 %\) · Pendientes: 1/);
  assert.equal(actions, 'Acciones propuestas: Colocar de baja: 1 · Reparar: 1 · Solo comentario: 1');
  assert.equal(takingSummaryLines([], '2026-11-01')[1], 'Acciones propuestas: ninguna');
  assert.deepEqual(takingSignatures('Luz'), [{ label: 'Responsable de la toma de inventario', name: 'Luz' }, { label: 'Nombre y firma' }]);
});

test('proposed actions: counts, filter and "has proposal"', () => {
  assert.deepEqual(proposedActionCounts(assets), {
    byAction: [
      { key: 'dispose', label: 'Colocar de baja', count: 1 },
      { key: 'repair', label: 'Reparar', count: 1 },
    ],
    commentOnly: 1,
  });
  assert.equal(hasProposal({ proposedActionNote: '  ' }), false);
  assert.deepEqual(filterByAction(assets, 'any').map((a) => a.id), ['1', '2', '3']);
  assert.deepEqual(filterByAction(assets, 'repair').map((a) => a.id), ['1']);
  assert.deepEqual(filterByAction(assets, 'sell', new Set(['3'])).map((a) => a.id), ['3'], 'kept rows stay');
  assert.equal(filterByAction(assets, ''), assets);
});

test('inventory update: proposed action whitelisted, comment trimmed and limited', () => {
  const update = sanitizeInventoryUpdate({
    locationId: 'l1',
    condition: 'good',
    availability: 'available',
    proposedAction: 'sell',
    proposedActionNote: ` ${'x'.repeat(300)} `,
  });
  assert.equal(update.proposedAction, 'sell');
  assert.equal(update.proposedActionNote.length, 200);
  assert.deepEqual(validateInventoryUpdate(update), {});
  assert.ok(validateInventoryUpdate({ ...update, proposedAction: 'burn' }).proposedAction);
});

test('history describes proposed actions', () => {
  assert.equal(describeValue('proposedAction', 'donate', lookups), 'Donar');
  assert.equal(describeValue('proposedAction', '', lookups), 'Ninguna');
  assert.deepEqual(diffAssets({}, { proposedAction: 'repair' }, lookups), [{ field: 'proposedAction', from: 'Ninguna', to: 'Reparar' }]);
  assert.deepEqual(diffAssets({}, { proposedAction: '' }, lookups), [], 'missing = none');
});
