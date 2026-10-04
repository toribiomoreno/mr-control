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

test('un mantenimiento abierto indica explícitamente continuidad sin confirmar', () => {
  const timeline = buildLifeLine([{ id: '709', tipo: 'correctivo', fecha: '2026-09-24', estadoMantenimiento: 'en_curso', metadata: { seguimiento: { detentionStart: '2026-09-24' } }, actualizaciones: [{ fecha: '2026-09-25', metadata: { seguimiento: { activity: 'espera' } } }] }], '2026-09-27');
  assert.equal(timeline.maintenance[0].end, '2026-09-27');
  assert.equal(timeline.maintenance[0].confirmedThrough, '2026-09-25');
  assert.equal(timeline.maintenance[0].unconfirmed, true);
  assert.equal(timeline.operation.length, 0);
});

test('toda unidad tiene un único estado por día, sin operativa superpuesta al mantenimiento', () => {
  for (const code of ['E721', 'E701', 'EM02', '7774']) {
    const events = [
      { id: 'report', tipo: 'otro', locomotoraCodigo: code, fecha: '2026-09-21', hora: '06:00', metadata: { dailyState: { state: 'operativa' } } },
      { id: 'repair', tipo: 'correctivo', locomotoraCodigo: code, fecha: '2026-09-21', hora: '10:00', estadoMantenimiento: 'finalizado', fechaCierre: '2026-09-22', metadata: { seguimiento: { outcome: 'operativa' } } },
      { id: 'same-day', tipo: 'preventivo', locomotoraCodigo: code, fecha: '2026-09-25', estadoMantenimiento: 'finalizado', fechaCierre: '2026-09-25', metadata: { seguimiento: { outcome: 'operativa' } } },
    ];
    const original = structuredClone(events);
    const timeline = buildLifeLine(events, '2026-09-27');
    for (const day of timeline.days) {
      const states = timeline.states.filter(s => s.start <= day && day <= s.end);
      assert.ok(states.length <= 1, `${code} tiene estados simultáneos el ${day}`);
      if (timeline.maintenance.some(m => m.start <= day && day <= m.end)) assert.equal(states[0].kind, 'detenida');
    }
    assert.equal(timeline.states.at(-1).kind, 'operativa');
    assert.deepEqual(events, original);
  }
});
