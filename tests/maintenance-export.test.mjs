import test from 'node:test';
import assert from 'node:assert/strict';
import { maintenanceCsv, maintenanceCsvRows, maintenanceCsvHeaders } from '../src/domain/maintenance/export.js';
import { buildMaintenanceIntake, editMaintenanceIntake } from '../src/domain/maintenance/capture.js';
import { hasMaintenanceDelay } from '../src/domain/maintenance/view.js';

const range = { from: '2026-09-21', to: '2026-09-27' };
const job = { id: 'repair', locomotoraCodigo: 'E705', tipo: 'correctivo', fecha: '2026-09-22', estadoMantenimiento: 'finalizado', fechaCierre: '2026-09-23', metadata: { seguimiento: { detentionStart: '2026-09-22', detentionReason: 'Oscila velocímetro', system: 'Registradores Ctrl.', component: 'Velocímetro' } }, actualizaciones: [] };
const update = (date, description, tracking = {}) => ({ id: date + description, fecha: date, descripcion: description, tipoActualizacion: 'avance', metadata: { seguimiento: { activity: 'trabajo', ...tracking } } });

test('CSV diario conserva días sin detalle y demoras confirmadas; no duplica bloques del mismo día', () => {
 const event = { ...job, actualizaciones: [update('2026-09-22', 'Se limpió la caja.'), update('2026-09-22', 'Se reemplazaron contactos.'), update('2026-09-23', 'Se realizó la prueba.', { activity: 'mixto', delayReported: true, cause: 'CAP', delayDescription: 'Vía ocupada' })] };
 const rows = maintenanceCsvRows([event], range, '2026-09-28');
 assert.equal(rows.length, 2); assert.equal(rows[0][8], 'Se limpió la caja. · Se reemplazaron contactos.'); assert.equal(rows[0][9], 'No');
 assert.equal(rows[1][9], 'Sí'); assert.match(rows[1][10], /^CAP · /);
 assert.equal(rows[0][6], '23/09/2026'); assert.equal(rows[0][7], '');
 const empty = maintenanceCsvRows([job], range, '2026-09-28');
 assert.equal(empty.length, 2); assert.equal(empty[0][9], 'No'); assert.match(empty[0][8], /Sin descripción/);
 assert(!maintenanceCsvHeaders.some(h => /observaciones|eficiencia|personal|duración/i.test(h)));
 assert.equal(rows[0].length, 14);
});
test('exportación respeta rango, anulaciones y prueba posterior al cierre sin repetir resumen semanal', () => {
 const result = { ...update('2026-09-24', 'Prueba acompañada.'), metadata: { seguimiento: { activity: 'sin_dato', outcome: 'operativa' }, followUpResult: { result: 'sin_novedades' } } };
 const event = { ...job, actualizaciones: [result, { ...update('2026-09-27', 'Resumen semanal'), metadata: { weeklySummary: { isoWeek: 39 } } }] };
 const rows = maintenanceCsvRows([event, { ...event, id: 'duplicate', anulado: true }], range, '2026-09-28');
 assert.equal(rows.length, 3); assert.equal(rows.at(-1)[5], '24/09/2026'); assert.match(rows.at(-1)[11], /sin novedades/);
 assert.equal(maintenanceCsvRows([event], { from: '2026-09-24', to: '2026-09-24' }, '2026-09-28').length, 1);
 const text = maintenanceCsv([event], range, '2026-09-28'); assert(text.startsWith('\uFEFF')); assert(text.includes('\r\n')); assert(!text.includes('Resumen semanal'));
});
test('preventivos nuevos, editados e históricos muestran kilometraje sin repetir el tipo en el motivo', () => {
 const preventive = buildMaintenanceIntake({ unit: 'E703', maintenanceType: 'E', reason: 'Preventivo E', startDate: '2026-09-24', startTime: '06:00' });
 assert.equal(preventive.metadata.seguimiento.detentionReason, 'Kilometraje');
 const edited = editMaintenanceIntake(preventive, { unit: 'E703', maintenanceType: 'E', startDate: '2026-09-24', startTime: '06:00' });
 assert.equal(edited.metadata.seguimiento.detentionReason, 'Kilometraje');
 const legacy = { ...job, tipo: 'preventivo', preventivoCodigo: 'E', metadata: { seguimiento: { ...job.metadata.seguimiento, detentionReason: 'Preventivo E' } } };
 const row = maintenanceCsvRows([legacy], range, '2026-09-28')[0]; assert.equal(row[2], 'Preventivo E'); assert.equal(row[3], 'Kilometraje');
});
test('demora omitida equivale a no; una causa o espera confirmada se conserva', () => {
 assert.equal(hasMaintenanceDelay(), false); assert.equal(hasMaintenanceDelay({ delayReported: null, pendingDelay: true }), false);
 assert.equal(hasMaintenanceDelay({ cause: 'CAP' }), true); assert.equal(hasMaintenanceDelay({ activity: 'espera' }), true);
 assert.equal(hasMaintenanceDelay({ cause: 'PENDIENTE' }), false);
 assert.equal(hasMaintenanceDelay({ additionalShiftRequired: true, extensionCause: 'GES' }), true);
});
test('un correctivo acepta tablero eléctrico solo dentro del sistema eléctrico', () => {
 const intake = buildMaintenanceIntake({ unit: 'E710', maintenanceType: 'Correctivo', reason: 'Terminal suelto', startDate: '2026-09-29', staff: 'Turno fijo', system: 'Sistema eléctrico', subsystem: 'Tablero eléctrico' });
 assert.equal(intake.metadata.seguimiento.component, 'Tablero eléctrico');
 assert.throws(() => buildMaintenanceIntake({ unit: 'E710', maintenanceType: 'Correctivo', reason: 'Falla', startDate: '2026-09-29', staff: 'Turno fijo', system: 'Motor diésel', subsystem: 'Tablero eléctrico' }), /subsistema/);
});
test('fin programado de preventivos y subsistema usan la misma clasificación y agenda de la ficha', () => {
 const event = { ...job, tipo: 'preventivo', preventivoCodigo: 'AB', fecha: '2026-09-22', hora: '14:00', metadata: { seguimiento: { detentionStart: '2026-09-22', detentionTime: '14:00' } }, actualizaciones: [update('2026-09-22', 'Revisión de tablero', { system:'Sistema eléctrico',subsystem:'Tablero eléctrico',component:'Cable TB 50' })] };
 const row = maintenanceCsvRows([event],range,'2026-09-28')[0];assert.equal(row[7],'23/09/2026');assert.equal(row[13],'Tablero eléctrico');
 const numeral = { ...event, preventivoCodigo:'Numeral 9',metadata:{seguimiento:{detentionStart:'2026-09-22',plannedEnd:'2026-09-25'}} };assert.equal(maintenanceCsvRows([numeral],range,'2026-09-28')[0][7],'25/09/2026');
});
