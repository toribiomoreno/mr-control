import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMaintenanceIntake, buildProgress, editMaintenanceIntake } from '../src/domain/maintenance/capture.js';
import { validateUpdate } from '../src/domain/maintenance/adapter.js';
import { nextShiftSelection, journalGroups } from '../src/domain/maintenance/journal.js';
import { validClassification } from '../src/domain/maintenance/taxonomy.js';
const event = { id:'example', locomotoraCodigo:'E714', tipo:'correctivo', titulo:'Ingreso original', descripcion:'Registro original', responsable:'Turno fijo', fecha:'2026-09-21', hora:'06:00', estadoMantenimiento:'en_curso', metadata:{ source:'original', seguimiento:{captureVersion:4, detentionStart:'2026-09-21', detentionTime:'06:00', detentionReason:'Baja presión', location:'Externo', system:'Motor diésel', subsystem:'Gobernador Woodward', component:'Impulsor', outcome:'continua', plannedStart:'2026-09-21', plannedEnd:'2026-09-28'} }, actualizaciones:[] };
const values = { date:'2026-09-22', description:'Revisión', staff:'Turno fijo', system:'Sistema eléctrico', subsystem:'Relés y contactores', duration:'.5', delayed:false, outcome:'continua' };
test('ficha nueva separa ingreso y trabajo, y cierra sólo con disponibilidad confirmada',()=>{
 const intake=buildMaintenanceIntake({unit:'E714',maintenanceType:'Correctivo',reason:'No acciona el contactor',startDate:'2026-09-21',startTime:'06:30',staff:values.staff,system:values.system,subsystem:values.subsystem});
 assert.equal(intake.descripcion,'No acciona el contactor');assert.equal(intake.estadoMantenimiento,'en_curso');assert.equal(intake.hora,'06:30');
 const progress=buildProgress(intake,null,{...values,outcome:'operativa',outcomeConfirmed:true});validateUpdate(intake,progress);assert.equal(progress.tipoActualizacion,'cierre');assert.equal(progress.descripcion,'Revisión');
 const light=buildMaintenanceIntake({unit:'E714',maintenanceType:'AB',reason:'Por ciclo',startDate:'2026-09-21',startTime:'14:00'});assert.equal(light.responsable,'Turno rotativo');assert.equal(light.preventivoCodigo,'AB');
});
test('agregar trabajo anterior al cierre conserva el mantenimiento finalizado',()=>{
 const closed={...event,estadoMantenimiento:'finalizado',fechaCierre:'2026-09-23'};
 const progress=buildProgress(closed,null,values);validateUpdate(closed,progress);assert.equal(progress.tipoActualizacion,'observacion');assert.equal(progress.metadata.seguimiento.activity,'trabajo');assert.equal(progress.estadoResultante,null);assert.equal(closed.fechaCierre,'2026-09-23');
 assert.throws(()=>validateUpdate(closed,buildProgress(closed,null,{...values,date:'2026-09-24',outcome:'operativa',outcomeConfirmed:true})),/después del cierre/);
});
test('preventivo cerrado: admite completar turnos del mismo día sin reabrir ni cambiar el cierre',()=>{
 const morning={id:'morning',fecha:'2026-09-22',tipoActualizacion:'avance',responsable:'Turno rotativo',descripcion:'Primer turno',metadata:{seguimiento:{activity:'trabajo',outcome:'continua',period:'Mañana',shiftNumber:1,shiftFinished:true}}};
 const closing={id:'closing',fecha:'2026-09-22',tipoActualizacion:'cierre',responsable:'Turno rotativo',descripcion:'Cambio de portaescobillas',metadata:{seguimiento:{activity:'trabajo',outcome:'operativa',outcomeConfirmed:true,period:'Tarde',shiftNumber:2,shiftFinished:true}}};
 const closed={...event,tipo:'preventivo',preventivoCodigo:'A',responsable:'Turno rotativo',estadoMantenimiento:'finalizado',fechaCierre:'2026-09-22',actualizaciones:[morning,closing]};
 const original=structuredClone(closed);
 const historical=buildProgress(closed,null,{...values,date:'2026-09-22',period:'Tarde',shiftNumber:2,shiftFinished:true,outcome:'continua'});
 validateUpdate(closed,historical);assert.equal(historical.tipoActualizacion,'observacion');assert.equal(historical.estadoResultante,null);assert.deepEqual(closed,original);
 const edited=buildProgress(closed,morning,{...values,period:'Mañana',shiftNumber:1,shiftFinished:true});validateUpdate(closed,edited);
 assert.throws(()=>validateUpdate({...closed,horaCierre:'14:00'}, {...historical,hora:'15:00'}),/continúa el mantenimiento/);
 const morningClosure={...closed,actualizaciones:[{...closing,metadata:{seguimiento:{...closing.metadata.seguimiento,period:'Mañana'}}}]};
 assert.throws(()=>validateUpdate(morningClosure,historical),/continúa el mantenimiento/);
});
test('ingreso restringido conserva programación, ubicación, descripción, estado y avances',()=>{
 const original=structuredClone(event); const next=editMaintenanceIntake(event,{unit:'E715',maintenanceType:'Correctivo',reason:'Motivo corregido',startDate:'2026-09-20',startTime:'07:30',location:'Boulogne',plannedEnd:''});
 assert.equal(next.metadata.seguimiento.location,'Externo');assert.equal(next.metadata.seguimiento.plannedEnd,'2026-09-28');assert.equal(next.titulo,event.titulo);assert.equal(next.descripcion,event.descripcion);assert.equal(next.estadoMantenimiento,event.estadoMantenimiento);assert.equal(next.actualizaciones,event.actualizaciones);assert.deepEqual(event,original);
 assert.throws(()=>editMaintenanceIntake({...event,actualizaciones:[{fecha:'2026-09-21'}]}, {unit:'E714',maintenanceType:'Correctivo',reason:'Motivo',startDate:'2026-09-22',startTime:''}),/después de un avance/);
});
test('bloques diarios: clasificación, medio día y prueba pendiente sin liberación',()=>{
 assert.ok(validClassification('Sistema eléctrico','Relés y contactores'));
 const pending=buildProgress(event,null,{...values,outcome:'prueba_parque'});validateUpdate(event,pending);assert.equal(pending.tipoActualizacion,'avance');assert.equal(pending.estadoUnidadResultante,'pendiente_de_prueba');assert.equal(pending.metadata.seguimiento.workDurationDays,.5);assert.equal(pending.metadata.seguimiento.usefulFraction,undefined);
 const closed=buildProgress(event,null,{...values,outcome:'operativa',outcomeConfirmed:true});validateUpdate(event,closed);assert.equal(closed.tipoActualizacion,'cierre');
 assert.throws(()=>validateUpdate(event,buildProgress(event,null,{...values,outcome:'operativa'})),/explícitamente/);
});
test('demora pide motivo y descripción; día sin trabajo no crea actividad útil',()=>{
 assert.throws(()=>buildProgress(event,null,{...values,delayed:true,cause:'CAP'}),/descripción/);
 const blocked=buildProgress(event,null,{...values,noWork:true,delayed:true,cause:'CAP',delayDescription:'Gatos ocupados'});validateUpdate(event,blocked);assert.equal(blocked.metadata.seguimiento.activity,'espera');assert.equal(blocked.metadata.seguimiento.fullDay,true);assert.equal(blocked.metadata.seguimiento.workDurationDays,null);
});
test('edición conserva campos retirados, referencias y reparto anterior',()=>{
 const old={id:'old',fecha:'2026-09-22',hora:'08:30',tipoActualizacion:'avance',porcentajeAvance:30,resultadoPrueba:'Anterior',pendientes:'Ensayo',metadata:{sourceId:'source',seguimiento:{activity:'mixto',period:'Mañana',system:'Motor diésel',subsystem:'Gobernador Woodward',component:'Impulsor',staffSpecialty:'Mecánica',weekendEligible:true,dayComplete:true,usefulFraction:.5,allocationNote:'Reparto confirmado',cause:'CAP',outcome:'continua'}}};
 const next=buildProgress(event,old,{...values,delayed:true,cause:'CAP',delayDescription:'Esperó por gatos'});validateUpdate(event,next);assert.equal(next.resultadoPrueba,'Anterior');assert.equal(next.pendientes,'Ensayo');assert.equal(next.porcentajeAvance,30);assert.equal(next.hora,'08:30');assert.equal(next.metadata.sourceId,'source');assert.equal(next.metadata.seguimiento.weekendEligible,true);assert.equal(next.metadata.seguimiento.staffSpecialty,'Mecánica');assert.equal(next.metadata.seguimiento.usefulFraction,.5);assert.equal(next.metadata.seguimiento.previousClassification.component,'Impulsor');
});
test('turno adicional queda enlazado al turno de origen y cuenta como extensión',()=>{
 const light={...event,tipo:'preventivo',preventivoCodigo:'AB',responsable:'Turno rotativo'};
 const first=buildProgress(light,null,{...values,shiftNumber:2,shiftFinished:false,additionalShiftRequired:true,period:'Tarde',cause:'MAT',delayDescription:'Faltó repuesto'});validateUpdate(light,first);
 light.actualizaciones=[first];assert.deepEqual(nextShiftSelection(light),{number:2,extended:true,extensionIndex:1});
 const extension=buildProgress(light,null,{...values,date:'2026-09-23',shiftNumber:2,shiftFinished:true,additionalShiftRequired:false,period:'Mañana',shiftExtended:true,extensionIndex:1});validateUpdate(light,extension);light.actualizaciones.push(extension);assert.equal(journalGroups(light)[1].label,'Turno 2 extendido');assert.equal(nextShiftSelection(light).number,3);
});

test('E finalizado cierra en su turno; primer turno de A y prueba pendiente no cierran',()=>{
 const e=buildMaintenanceIntake({unit:'E713',maintenanceType:'E',startDate:'2026-10-05',startTime:'6:00'});
 const done=buildProgress(e,null,{...values,date:'2026-10-05',period:'Mañana',shiftNumber:1,shiftFinished:true,outcome:'continua'});
 validateUpdate(e,done);assert.equal(done.tipoActualizacion,'cierre');assert.equal(done.hora,'14:00');assert.equal(done.metadata.seguimiento.outcome,'operativa');
 const a=buildMaintenanceIntake({unit:'E705',maintenanceType:'A',startDate:'2026-10-05',startTime:'14:00'});
 const first=buildProgress(a,null,{...values,date:'2026-10-05',period:'Tarde',shiftNumber:1,shiftFinished:true,outcome:'continua'});
 validateUpdate(a,first);assert.equal(first.tipoActualizacion,'avance');assert.equal(first.hora,null);
 const pending=buildProgress(e,null,{...values,date:'2026-10-05',period:'Mañana',shiftNumber:1,shiftFinished:true,outcome:'prueba_parque'});
 validateUpdate(e,pending);assert.equal(pending.tipoActualizacion,'avance');
});
test('turno final histórico corrige solo el cierre automático del parte, sin reabrir',()=>{
 const e={...buildMaintenanceIntake({unit:'E713',maintenanceType:'E',startDate:'2026-10-05',startTime:'06:00'}),estadoMantenimiento:'finalizado',fechaCierre:'2026-10-06',metadata:{dailyStateClosure:{updateId:'report'},seguimiento:{detentionStart:'2026-10-05',location:'Boulogne'}}};
 const done=buildProgress(e,null,{...values,date:'2026-10-05',period:'Mañana',shiftNumber:1,shiftFinished:true,outcome:'continua'});
 validateUpdate(e,done);assert.equal(done.tipoActualizacion,'observacion');assert.equal(done.metadata.seguimiento.completedFinalShift,true);assert.equal(done.hora,'14:00');
 const manual=buildProgress({...e,metadata:{seguimiento:e.metadata.seguimiento}},null,{...values,date:'2026-10-05',period:'Mañana',shiftNumber:1,shiftFinished:true,outcome:'continua'});
 assert.equal(manual.metadata.seguimiento.completedFinalShift,false);
});
