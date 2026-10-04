import test from 'node:test';
import assert from 'node:assert/strict';
import { subsystemsBySystem, validClassification } from '../src/domain/maintenance/taxonomy.js';
import { summarizeFleet } from '../src/domain/maintenance/fleetSummary.js';
import { fleetState } from '../src/domain/maintenance/fleetState.js';
import { journalGroups, shiftEfficiency } from '../src/domain/maintenance/journal.js';
import { buildLifeLine } from '../src/domain/maintenance/lifeLine.js';
import { validateUpdate, toRegister } from '../src/domain/maintenance/adapter.js';
import { maintenanceEfficiency } from '../src/domain/maintenance/presentation.js';
import { pendingFollowUps } from '../src/domain/maintenance/followUp.js';
const date='2026-09-21';
const base={id:'job',locomotoraCodigo:'E701',tipo:'correctivo',fecha:date,hora:'10:00',estadoMantenimiento:'en_curso',metadata:{seguimiento:{detentionStart:date,detentionReason:'Revisión sintética',system:'Motor diésel',subsystem:'Inyectores',component:'Inyectores',location:'Boulogne',outcome:'continua'}},actualizaciones:[]};
const note=(id,date,extra={})=>({id,fecha:date,hora:'14:00',tipoActualizacion:'avance',responsable:'Turno fijo',descripcion:'Trabajo de prueba',metadata:{seguimiento:{captureVersion:4,system:'Motor diésel',subsystem:'Inyectores',component:'Inyectores',period:'Mañana',activity:'trabajo',workDurationDays:1,outcome:'continua',...extra}}});
test('8 sistemas y 25 subsistemas únicos; no hay correspondencias cruzadas',()=>{
 assert.equal(Object.keys(subsystemsBySystem).length,8);const all=Object.values(subsystemsBySystem).flat();assert.equal(all.length,25);assert.equal(new Set(all).size,25);assert.equal(validClassification('Motor diésel','Par montado'),false);
});
test('cobertura compara operativas con 16 y unifica uso condicional',()=>{
 const result=summarizeFleet([...Array.from({length:15},()=>({estado:'operativa'})),{estado:'correctivo'},{estado:'preventivo'},{estado:'reserva'},{estado:'uso_condicional'}]);assert.equal(result.balance,-1);assert.equal(result.detenida,2);assert.equal(result.uso_excepcional,1);assert.equal(result.coverage,93.75);
});
test('parte a las 6, ingreso a las 10 y cierre a las 14 actualizan la misma unidad',()=>{
 const daily={id:'daily',tipo:'otro',locomotoraCodigo:'E701',fecha:date,hora:'06:00',metadata:{dailyState:{reportedState:'operativa',state:'operativa',observation:'Nota del parte'}}};
 assert.equal(fleetState({codigo:'E701'},[daily],date).estado,'operativa');assert.equal(fleetState({codigo:'E701'},[daily,base],date).estado,'correctivo');
 const closed={...base,estadoMantenimiento:'finalizado',fechaCierre:date,horaCierre:'14:00',actualizaciones:[{...note('close',date,{outcome:'operativa',outcomeConfirmed:true}),tipoActualizacion:'cierre'}]};
 assert.equal(fleetState({codigo:'E701'},[daily,closed],date).estado,'operativa');assert.match(fleetState({codigo:'E701'},[daily,closed],date).observacion,/Nota del parte/);
 const states=buildLifeLine([daily,closed],date).states;assert.equal(states.at(-1).kind,'operativa');
});
test('dos bloques el mismo día conservan sistemas y cuentan solo una jornada',()=>{
 const event={...base,actualizaciones:[note('one',date),note('two',date,{system:'Bogies',subsystem:'Cojinetes'})]};const groups=journalGroups(event);assert.equal(groups.length,1);assert.equal(groups[0].updates.length,2);const register=toRegister([event]);assert.equal(maintenanceEfficiency(register,register.maintenances[0],undefined,'2026-09-22').worked,1);
});
test('numerales exigen sistema y subsistema, y el alta exige confirmación explícita',()=>{
 const heavy={...base,tipo:'preventivo',preventivoCodigo:'Numeral 9'};const update=note('one',date,{system:'Bogies',subsystem:'Inyectores'});assert.throws(()=>validateUpdate(heavy,update,'2026-09-22'),/subsistema/);
 const release={...note('close',date,{outcome:'operativa'}),tipoActualizacion:'cierre'};assert.throws(()=>validateUpdate(base,release,'2026-09-22'),/explícitamente/);release.metadata.seguimiento.outcomeConfirmed=true;assert.doesNotThrow(()=>validateUpdate(base,release,'2026-09-22'));
});
test('AB con turno 2 extendido: cuatro turnos, cumplimiento 75%',()=>{
 const light={...base,tipo:'preventivo',preventivoCodigo:'AB',estadoMantenimiento:'finalizado',fechaCierre:'2026-09-23',actualizaciones:[note('1',date,{shiftNumber:1}),note('2',date,{shiftNumber:2}),note('2e','2026-09-22',{shiftNumber:2,shiftExtended:true,extensionIndex:1}),note('3','2026-09-23',{shiftNumber:3})]};
 assert.deepEqual(journalGroups(light).map(g=>g.label),['Turno 1','Turno 2','Turno 2 extendido','Turno 3']);assert.equal(shiftEfficiency(light).percent,75);assert.equal(shiftEfficiency(light).registered,4);
});
test('una prueba pendiente mantiene detenida y programa la consulta siguiente',()=>{
 for(const outcome of ['prueba_parque','prueba_linea']){const event={...base,actualizaciones:[note('test',date,{outcome})]};assert.equal(fleetState({codigo:'E701'},[event],date).estado,'correctivo');const pending=pendingFollowUps([event],'2026-09-22','09:00');assert.equal(pending.length,1);assert.equal(pending[0].due,true);}
});
