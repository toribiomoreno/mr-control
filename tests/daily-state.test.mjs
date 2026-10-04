import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFleetStatusText, buildFleetImportPreview } from '../src/services/importacionEstadoFlotaService.js';
import { dailyStateRecord, maintenanceAt } from '../src/domain/maintenance/dailyState.js';
import { pendingFollowUps, followUpKind } from '../src/domain/maintenance/followUp.js';
import { fleetState } from '../src/domain/maintenance/fleetState.js';
import { outcomeAtEnd, trackingForCurrentState, operatingSegments } from '../src/domain/maintenance/view.js';
import { validateUpdate } from '../src/domain/maintenance/adapter.js';

const job = { id: 'job', locomotoraCodigo: '7774', fecha: '2026-09-29', tipo: 'correctivo', estadoMantenimiento: 'finalizado', fechaCierre: '2026-09-29', horaCierre: '14:00', metadata: { seguimiento: { detentionStart: '2026-09-29', outcome: 'operativa_prueba' } }, actualizaciones: [{ id: 'close', fecha: '2026-09-29', hora: '14:00', tipoActualizacion: 'cierre', metadata: { seguimiento: { outcome: 'operativa_prueba' } } }] };
test('una celda vacía conserva la observación y asigna operativa; no desplaza columnas', () => {
 const text='Loc.\tEstado\tObservaciones\n701\t\tSale acompañada\n702\tReserva\tVer presión\n703\t\t';
 const rows=parseFleetStatusText(text);
 assert.equal(rows[0].rawState,'');assert.equal(rows[0].reason,'Sale acompañada');assert.equal(rows[1].rawState,'Reserva');
 const preview=buildFleetImportPreview({date:'2026-09-30',time:'06:00',text,locomotoras:['E701','E702','E703'].map(codigo=>({codigo}))});
 assert.equal(preview.canConfirm,true);assert.equal(preview.rows[0].newState,'operativa');
 const loose=parseFleetStatusText('Loc. Estado Observaciones\n701 Sale acompañada');assert.equal(loose[0].reason,'Sale acompañada');assert.equal(loose[0].rawState,'');
 assert.equal(parseFleetStatusText('Loc.\tEstado\tObservaciones\n701\t\tRevisión de la locomotora en fosa')[0].reason,'Revisión de la locomotora en fosa');
});
test('el estado diario a las seis respeta una detención hasta las catorce y no inventa trabajo', () => {
 const row={unit:'7774',reportDate:'2026-09-29',reportTime:'06:00',newState:'operativa',reason:'Sale acompañada'};
 const state=dailyStateRecord(row,[job]);assert.equal(state.state,'detenida');assert.equal(state.reportedState,'operativa');assert.equal(state.conflict,true);
 assert.equal(maintenanceAt([job],'7774','2026-09-29','15:00').length,0);
 const stopped=dailyStateRecord({...row,unit:'E701',newState:'detenida'},[job]);assert.equal(stopped.needsMaintenance,true);
 const later={...job,metadata:{seguimiento:{...job.metadata.seguimiento,detentionAfterReport:{date:'2026-09-29',time:'05:44'}}}};
 assert.equal(maintenanceAt([later],'7774','2026-09-29','05:44').length,0);
 assert.equal(maintenanceAt([later],'7774','2026-09-29','15:00').length,0);
});
test('el parte persiste como estado de la misma unidad y nunca da disponible un mantenimiento abierto', () => {
 const daily={id:'daily',tipo:'otro',locomotoraCodigo:'7774',fecha:'2026-09-30',hora:'06:00',metadata:{dailyState:{state:'operativa',reportedState:'operativa',observation:'Sale acompañada'}}};
 const state=fleetState({codigo:'7774'},[job,daily],'2026-09-30');assert.equal(state.estado,'operativa');assert.equal(state.fechaParte,'2026-09-30');assert.equal(state.observacion,'Sale acompañada');
 assert.equal(fleetState({codigo:'7774'},[{...job,estadoMantenimiento:'en_curso'},daily],'2026-09-30').estado,'correctivo');
 const oldDaily={...daily,fecha:'2026-09-28'};assert.equal(fleetState({codigo:'7774'},[job,oldDaily],'2026-09-30').observacion,'Operativa · prueba pendiente · Sale acompañada');
 assert.equal(operatingSegments([daily],'2026-09-30','2026-09-30').length,1);
});
test('cierre operativo con pruebas pendientes conserva el plan y admite validación sin trabajo supuesto', () => {
 assert.equal(outcomeAtEnd(job).code,'operativa_prueba');assert.equal(trackingForCurrentState(job).outcome,'operativa_prueba');
 const open={...job,estadoMantenimiento:'en_curso',actualizaciones:[]};
 validateUpdate(open,{fecha:'2026-09-29',tipoActualizacion:'cierre',descripcion:'Quedó operativa con prueba pendiente',metadata:{seguimiento:{activity:'sin_dato',outcome:'operativa_prueba'}}},'2026-09-30');
 const resolved={...job,actualizaciones:[...job.actualizaciones,{id:'result',fecha:'2026-09-30',hora:'09:10',metadata:{followUpResult:{key:'avance:close',kind:'prueba',result:'sin_novedades'},seguimiento:{activity:'sin_dato'}}}]};
 assert.equal(outcomeAtEnd(resolved).code,'operativa');assert.equal(pendingFollowUps([resolved],'2026-09-30','10:00').length,0);
});
test('salida del parte pregunta el mismo día a las nueve; mantenimiento pregunta al siguiente', () => {
 const daily={id:'daily',fecha:'2026-09-30',locomotoraCodigo:'E701',metadata:{dailyState:{observation:'Sale acompañada'}}};
 const pending=pendingFollowUps([daily,job],'2026-09-30','08:59');assert.equal(pending.length,2);assert.ok(pending.every(item=>!item.due));
 assert.ok(pendingFollowUps([daily,job],'2026-09-30','09:00').every(item=>item.due));
 assert.equal(followUpKind('No sale acompañada'),'');assert.equal(followUpKind('Sale acompanada'),'acompanada');
 const repeated={...daily,id:'daily2',hora:'07:00'};assert.equal(pendingFollowUps([daily,repeated],'2026-09-30','09:00').length,1);
 const result={id:'result',fecha:'2026-09-30',locomotoraCodigo:'E701',metadata:{followUpResult:{key:'parte:daily2',kind:'acompanada',result:'sin_novedades'}}};
 assert.equal(pendingFollowUps([daily,repeated,result],'2026-09-30','10:00').length,0);
 const retry={...result,metadata:{followUpResult:{...result.metadata.followUpResult,result:'pendiente'}}};
 const queue=pendingFollowUps([daily,repeated,retry],'2026-09-30','10:00');assert.equal(queue.length,1);assert.equal(queue[0].dueDate,'2026-10-01');
 const earlier={...daily,fecha:'2026-09-21'};
 const laterJob={id:'new',locomotoraCodigo:'E701',fecha:'2026-09-22',tipo:'correctivo',estadoMantenimiento:'en_curso'};
 assert.equal(pendingFollowUps([earlier,laterJob],'2026-09-30','10:00').length,0);
});
