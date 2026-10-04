import test from 'node:test';
import assert from 'node:assert/strict';
import { lightSchedule } from '../src/domain/maintenance/schedule.js';
import { updateOutcomeLabel } from '../src/domain/maintenance/view.js';
import { buildProgress } from '../src/domain/maintenance/capture.js';
import { validateUpdate, toRegister } from '../src/domain/maintenance/adapter.js';
import { maintenanceEfficiency } from '../src/domain/maintenance/presentation.js';
const daily = { id:'job', locomotoraCodigo:'E714', tipo:'correctivo', fecha:'2026-09-21', estadoMantenimiento:'en_curso', metadata:{seguimiento:{location:'Boulogne',detentionStart:'2026-09-21',system:'Sistema neumático',component:'Compresor'}},actualizaciones:[] };
const turn = (fecha, period, extra={}) => ({fecha,metadata:{seguimiento:{activity:'trabajo',shiftNumber:1,period,...extra}}});
const light = (code,period='Tarde') => ({...daily,tipo:'preventivo',preventivoCodigo:code,actualizaciones:[turn('2026-09-21',period)]});
test('E, A, AB y ABC alternan mañana y tarde, sin noche, también en fin de semana',()=>{
 for(const [code,date,time] of [['E','2026-09-21','22:00'],['A','2026-09-22','14:00'],['AB','2026-09-22','22:00'],['ABC','2026-09-24','14:00']]) {
  const schedule=lightSchedule(light(code));assert.equal(schedule.end,date);assert.equal(schedule.endTime,time);
 }
 assert.equal(lightSchedule(light('AB','Mañana')).endTime,'14:00');
 const weekend=light('AB');weekend.actualizaciones[0].fecha='2026-09-26';assert.equal(lightSchedule(weekend).end,'2026-09-27');
 assert.equal(lightSchedule(daily),null);
 assert.equal(lightSchedule({...light('AB'),actualizaciones:[]}),null);
 assert.equal(lightSchedule({...light('AB'),actualizaciones:[],metadata:{seguimiento:{plannedStart:'2026-09-21',plannedStartTime:'14:00'}}}).end,'2026-09-22');
});
test('cada extensión agrega un turno, sin contar dos veces solicitud y registro',()=>{
 const event=light('AB');event.actualizaciones[0].metadata.seguimiento.additionalShiftRequired=true;
 assert.equal(lightSchedule(event).end,'2026-09-23');assert.equal(lightSchedule(event).endTime,'14:00');
 event.actualizaciones.push(turn('2026-09-22','Mañana',{shiftExtended:true,extensionIndex:1}));assert.equal(lightSchedule(event).extensions,1);
 event.actualizaciones[1].metadata.seguimiento.additionalShiftRequired=true;assert.equal(lightSchedule(event).extensions,2);assert.equal(lightSchedule(event).endTime,'22:00');
});
test('estado no confirmado continúa con trabajo posterior del mismo mantenimiento, conservando confirmaciones',()=>{
 const old=turn('2026-09-21','Mañana',{outcome:'pendiente'});const next=turn('2026-09-22','Mañana');const event={...daily,actualizaciones:[old,next]};
 assert.equal(updateOutcomeLabel(event,old),'Continúa el mantenimiento');assert.equal(old.metadata.seguimiento.outcome,'pendiente');
 assert.equal(updateOutcomeLabel({...event,actualizaciones:[old]},old),'Por confirmar');
 for(const outcome of ['prueba_parque','operativa','detenida']) {old.metadata.seguimiento.outcome=outcome;assert.notEqual(updateOutcomeLabel(event,old),'Continúa el mantenimiento');}
 old.metadata.seguimiento.outcome='pendiente';next.metadata.seguimiento.activity='sin_dato';assert.equal(updateOutcomeLabel(event,old),'Por confirmar');
});
test('estado omitido no libera la máquina y Man / FA se guardan y se incorporan a eficiencia',()=>{
 const values={date:'2026-09-21',description:'Trabajo registrado',staff:'Turno fijo',system:'Sistema neumático',subsystem:'Compresor',duration:1,delayed:false};
 const incomplete=buildProgress(daily,null,values);validateUpdate(daily,incomplete);assert.equal(incomplete.metadata.seguimiento.outcome,'pendiente');assert.notEqual(incomplete.tipoActualizacion,'cierre');assert.notEqual(incomplete.estadoUnidadResultante,'servicio');
 for(const cause of ['Man','FA']) {
  const blocked=buildProgress(daily,null,{...values,noWork:true,delayed:true,cause,delayDescription:'Demora documentada'});validateUpdate(daily,blocked);
  const register=toRegister([{...daily,estadoMantenimiento:'finalizado',fechaCierre:'2026-09-21',actualizaciones:[blocked]}]);const result=maintenanceEfficiency(register,register.maintenances[0],undefined,'2026-09-22');assert.equal(result.losses[cause],1);
 }
});
