import test from 'node:test';
import assert from 'node:assert/strict';
import { isoWeek, maintenanceBars, dailyMaintenance, outcomeAtEnd, operatingSegments } from '../src/domain/maintenance/view.js';
import { buildLifeLine } from '../src/domain/maintenance/lifeLine.js';
import { validateUpdate } from '../src/domain/maintenance/adapter.js';

test('semana ISO: domingo y cambio de año', () => {
  assert.deepEqual(isoWeek('2026-09-27'), { year:2026, number:39 });
  assert.deepEqual(isoWeek('2027-01-01'), { year:2026, number:53 });
  assert.deepEqual(isoWeek('2027-01-04'), { year:2027, number:1 });
});
const event = { id:'test', tipo:'correctivo', fecha:'2026-09-24', estadoMantenimiento:'finalizado', fechaCierre:'2026-09-25', descripcion:'Motivo de ejemplo\nNotas adicionales', metadata:{seguimiento:{detentionStart:'2026-09-23',availableDate:'2026-09-25'}}, actualizaciones:[{ id:'update', fecha:'2026-09-24', metadata:{seguimiento:{activity:'espera',cause:'CAP'}} }] };
test('semana y línea de vida comparten motivo, inicio de detención y final; día sin avance no inventa actividad', () => {
  const weekly = maintenanceBars([event], '2026-09-21', '2026-09-27', '2026-09-27')[0];
  const life = buildLifeLine([event], '2026-09-27').maintenance[0];
  for (const key of ['start','end','label','reason','kind']) assert.equal(life[key], weekly[key]);
  assert.equal(weekly.start, '2026-09-23');
  assert.equal(weekly.label, 'Motivo de ejemplo');
  assert.equal(dailyMaintenance([event], '2026-09-23', '2026-09-27')[0].updates.length, 0);
  assert.equal(dailyMaintenance([event], '2026-09-24', '2026-09-27')[0].updates[0].metadata.seguimiento.cause, 'CAP');
});
test('disponible no significa operativa y un nuevo mantenimiento corta la franja', () => {
  assert.equal(outcomeAtEnd(event).code,'disponible');
  const other = { ...event, id:'next',fecha:'2026-09-27',estadoMantenimiento:'en_curso',fechaCierre:null,metadata:{seguimiento:{detentionStart:'2026-09-27'}} };
  const segments = operatingSegments([event,other],'2026-09-21','2026-09-27');
  assert.equal(segments[0].kind,'disponible');
  assert.equal(segments[0].end,'2026-09-26');
  const operational = { ...event,actualizaciones:[{fecha:'2026-09-25',metadata:{seguimiento:{outcome:'operativa'}}}] };
  assert.equal(operatingSegments([operational],'2026-09-21','2026-09-27')[0].kind,'operativa');
});
test('un cierre no puede indicar continuidad y una disponibilidad requiere cierre', () => {
  const open = { ...event,estadoMantenimiento:'en_curso',actualizaciones:[] };
  const update = {fecha:'2026-09-25',descripcion:'Avance',tipoActualizacion:'cierre',metadata:{seguimiento:{activity:'sin_dato',outcome:'continua'}}};
  assert.throws(() => validateUpdate(open, update, '2026-09-27'), /cierre no puede/);
  assert.throws(() => validateUpdate(open, {...update,tipoActualizacion:'avance',metadata:{seguimiento:{activity:'sin_dato',outcome:'operativa'}}}, '2026-09-27'), /disponibilidad requiere/);
});
