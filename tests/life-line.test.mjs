import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLifeLine } from '../src/domain/maintenance/lifeLine.js';

test('continúa el mismo mantenimiento y corta el tramo cuando empieza otro', () => {
  const timeline = buildLifeLine([
    { id: 'compresor', tipo: 'correctivo', fecha: '2026-09-21', fechaCierre: '2026-09-22', estadoMantenimiento: 'finalizado', titulo: 'Cambio de compresor', metadata: { seguimiento: { detentionStart: '2026-09-21', availableDate: '2026-09-22' } } },
    { id: 'puerta', tipo: 'correctivo', fecha: '2026-09-25', fechaCierre: '2026-09-25', estadoMantenimiento: 'finalizado', titulo: 'Puerta', metadata: { seguimiento: { detentionStart: '2026-09-25', availableDate: '2026-09-25' } } },
  ], '2026-09-27');
  assert.deepEqual(timeline.maintenance.map(({ id, span }) => [id, span]), [['compresor', 2], ['puerta', 1]]);
  assert.deepEqual(timeline.operation.map(({ start, end }) => [start, end]), [['2026-09-23', '2026-09-24'], ['2026-09-26', '2026-09-27']]);
  assert.equal(timeline.hasUnconfirmedDays, true);
});

test('un mantenimiento abierto se dibuja solo hasta la última detención confirmada', () => {
  const timeline = buildLifeLine([{ id: '709', tipo: 'correctivo', fecha: '2026-09-24', estadoMantenimiento: 'en_curso', metadata: { seguimiento: { detentionStart: '2026-09-24' } }, actualizaciones: [{ fecha: '2026-09-25' }] }], '2026-09-27');
  assert.equal(timeline.maintenance[0].end, '2026-09-25');
  assert.equal(timeline.operation.length, 0);
});
