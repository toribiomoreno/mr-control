import test from 'node:test';
import assert from 'node:assert/strict';
import { fleetState } from '../src/domain/maintenance/fleetState.js';

const loco = { codigo: 'E721', estado: 'servicio', observacion: 'Ejemplo antiguo' };
const job = { id: 'a', locomotoraCodigo: 'E721', tipo: 'correctivo', fecha: '2026-09-21',
  estadoMantenimiento: 'en_curso', descripcion: 'Cambio de compresor',
  metadata: { seguimiento: { detentionStart: '2026-09-21', confirmedThrough: '2026-09-25' } }, actualizaciones: [] };

test('el parque no presenta como operativa una máquina sin estado actualizado', () => {
  assert.equal(fleetState(loco, [], '2026-09-27').estado, 'sin_confirmar');
  const open = fleetState(loco, [job], '2026-09-27');
  assert.equal(open.estado, 'correctivo');
  assert.equal(open.estadoConfirmado, false);
  assert.match(open.observacion, /compresor/);
});

test('un cierre deja la máquina operativa y un nuevo correctivo prevalece', () => {
  const closed = { ...job, estadoMantenimiento: 'finalizado', fechaCierre: '2026-09-22',
    metadata: { seguimiento: { ...job.metadata.seguimiento, availableDate: '2026-09-22' } } };
  assert.equal(fleetState(loco, [closed], '2026-09-27').estado, 'operativa');
  assert.equal(fleetState(loco, [closed, { ...job, id: 'b', fecha: '2026-09-25' }], '2026-09-27').estado, 'correctivo');
});

test('una confirmación manual persiste como estado de la misma unidad, pero no cierra un correctivo', () => {
  const confirmation = { id: 'confirm-1', locomotoraCodigo: 'E721', tipo: 'otro', fecha: '2026-09-26', hora: '10:00',
    descripcion: 'Parte verificado en taller', metadata: { fleetConfirmation: { state: 'operativa' } } };
  assert.equal(fleetState(loco, [confirmation], '2026-09-27').estado, 'operativa');
  assert.equal(fleetState(loco, [job, confirmation], '2026-09-27').estado, 'correctivo');
  const laterJob = { ...job, id: 'later', fecha: '2026-09-27', metadata: { seguimiento: { detentionStart: '2026-09-27' } } };
  assert.equal(fleetState(loco, [confirmation, laterJob], '2026-09-27').estado, 'correctivo');
});
