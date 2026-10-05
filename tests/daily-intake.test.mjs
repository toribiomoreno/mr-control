import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyImportBatch, maintenanceIntake } from '../src/domain/maintenance/dailyIntake.js';
import { fleetState } from '../src/domain/maintenance/fleetState.js';
import { validateUpdate, toRegister } from '../src/domain/maintenance/adapter.js';
import { evidenceQuestions } from '../src/domain/maintenance/view.js';

const date='2026-10-01', time='06:00';
const row={unit:'E701',newState:'detenida',reason:'Revisión de componente de prueba',classification:'sin_clasificar'};
test('detenida con motivo abre un ingreso sin inventar trabajo y enlaza el parte',()=>{
 const batch=dailyImportBatch({date,time,rows:[row]},[],()=> 'intake');
 assert.equal(batch.created,1);assert.equal(batch.intakes.length,1);assert.equal(batch.rows.length,2);
 const job=batch.intakes[0];
 assert.equal(job.tipo,'correctivo');assert.equal(job.estadoMantenimiento,'en_curso');assert.equal(job.metadata.seguimiento.detentionReason,row.reason);
 assert.deepEqual(job.actualizaciones,[]);assert.equal(toRegister([job]).observations.length,0);
 assert.deepEqual(batch.rows[1].metadata.dailyState.maintenanceIds,['intake']);assert.equal(batch.rows[1].metadata.dailyState.needsMaintenance,false);
 assert.ok(evidenceQuestions(job).some(q=>q.text.includes('personal')));
 assert.ok(evidenceQuestions(job).some(q=>q.text.includes('sistema')));
 const update={fecha:date,descripcion:'Trabajo',tipoActualizacion:'avance',responsable:'Turno fijo',metadata:{seguimiento:{activity:'trabajo',period:'Mañana',captureVersion:3,workDurationDays:1,outcome:'continua'}}};
 assert.throws(()=>validateUpdate(job,update,date),/sistema/);
});
test('el parte confirma continuidad de E714 y EM02, sin duplicar mantenimiento ni avances',()=>{
 for(const unit of ['E714','EM02']){
  const job={...maintenanceIntake({...row,unit},'2026-09-30',time,[],'existing'),fecha:'2026-09-30'};
  const daily={id:'daily',locomotoraCodigo:unit,fecha:date,hora:time,metadata:{dailyState:{reportedState:'detenida',state:'detenida',observation:'Continúa revisión'}}};
  assert.equal(maintenanceIntake({...row,unit},date,time,[job],'new'),null);
  const state=fleetState({codigo:unit,estado:'operativa',fechaParte:'2026-09-20'},[job,daily],date);
  assert.equal(state.estado,'correctivo');assert.equal(state.estadoConfirmado,true);assert.equal(state.conflictoEstado,false);
  assert.equal(toRegister([job]).observations.length,0);
  assert.equal(fleetState({codigo:unit},[job,{...daily,fecha:'2026-09-29'}],date).estadoConfirmado,false);
 }
});
test('reserva con preventivo programado no abre trabajo; código incompleto y falta de motivo no se inventan',()=>{
 assert.equal(maintenanceIntake({...row,newState:'reserva',reason:'Preventivo E turno tarde'},date,time,[],'a'),null);
 assert.equal(maintenanceIntake({...row,reason:''},date,time,[],'b'),null);
 assert.equal(maintenanceIntake({...row,classification:'preventivo',preventiveCode:''},date,time,[],'c'),null);
 const preventive=maintenanceIntake({...row,reason:'Preventivo AB',classification:'preventivo',preventiveCode:'AB'},date,time,[],'d');
 assert.equal(preventive.tipo,'preventivo');assert.equal(preventive.preventivoCodigo,'AB');assert.deepEqual(preventive.actualizaciones,[]);
});
test('reimportar un parte idéntico no duplica; un cambio rechaza el lote antes del guardado',()=>{
 const state={locomotoraCodigo:row.unit,fecha:date,hora:time,metadata:{dailyState:{reportedState:row.newState,observation:row.reason}}};
 const batch=dailyImportBatch({date,time,rows:[row]},[state],()=> 'a');
 assert.equal(batch.created,0);assert.equal(batch.unchanged,1);assert.deepEqual(batch.rows,[]);
 assert.throws(()=>dailyImportBatch({date,time,rows:[{...row,reason:'Otro motivo'}]},[state],()=> 'b'),/parte distinto/);
});
test('parte disponible prepara cierre sin inventar avances y advierte antes de confirmar',()=>{
 const job=maintenanceIntake(row,'2026-09-30',time,[],'open');
 const batch=dailyImportBatch({date,time,rows:[{...row,newState:'operativa',reason:''}]},[job],()=> 'daily');
 assert.equal(batch.rows.length,1);assert.equal(batch.intakes.length,0);assert.equal(batch.rows[0].metadata.dailyState.state,'operativa');assert.deepEqual(batch.rows[0].metadata.dailyState.closingMaintenanceIds,['open']);assert.equal(batch.rows[0].metadata.dailyState.conflict,false);assert.deepEqual(job.actualizaciones,[]);
 const later={...job,actualizaciones:[{fecha:date,hora:'14:00',tipoActualizacion:'avance'}]};
 const oldReport=dailyImportBatch({date,time,rows:[{...row,newState:'operativa',reason:''}]},[later],()=> 'daily');assert.equal(oldReport.rows[0].metadata.dailyState.state,'detenida');assert.deepEqual(oldReport.rows[0].metadata.dailyState.closingMaintenanceIds,[]);
});
