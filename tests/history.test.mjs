import test from 'node:test';
import assert from 'node:assert/strict';
import { compareHistoryEvents, historyDates, historyMatchesDates, historyStaff, historyMatchesSearch } from '../src/domain/maintenance/history.js';
import { trackingForCurrentState, evidenceQuestions, workDurationLabel } from '../src/domain/maintenance/view.js';
import { validateEvent, validateUpdate } from '../src/domain/maintenance/adapter.js';
const event = { locomotoraCodigo:'E721', tipo:'correctivo', fecha:'2026-09-21', fechaCierre:'2026-09-22', titulo:'Cambio de compresor', descripcion:'Revisión del equipo', responsable:'Por confirmar', estadoMantenimiento:'finalizado', metadata:{ seguimiento:{ detentionStart:'2026-09-21', location:'Boulogne', system:'Sistema neumático', component:'Compresor' } }, actualizaciones:[{ fecha:'2026-09-22', descripcion:'Disponible después del centrado', responsable:'Turno fijo', metadata:{seguimiento:{activity:'trabajo',staffSpecialty:'Mecánico'}} }] };
test('E701: libro 03:00, parte 05:44, correctivo sin hora; días recientes primero', () => {
 const day = '2026-09-29';
 const items = [{id:'repair',fecha:day,tipo:'correctivo'}, {id:'daily',fecha:day,hora:'05:44:00',metadata:{dailyState:{}}}, {id:'book',fecha:day,hora:'03:00:00',tipo:'libro'}, {id:'newer',fecha:'2026-09-30',tipo:'libro',hora:'02:00'}];
 assert.deepEqual(items.sort(compareHistoryEvents).map(e=>e.id),['newer','book','daily','repair']);
 const intake={id:'intake',fecha:day,hora:'05:44',tipo:'correctivo'};
 assert.deepEqual([intake,items[2]].sort(compareHistoryEvents).map(e=>e.id),['daily','intake']);
});
test('histórico: rango de detención, filtro por superposición y personal de los avances', () => {
 assert.equal(historyDates(event),'21 – 22 SEP 2026');
 assert.ok(historyMatchesDates(event,'2026-09-22','2026-09-22'));
 assert.equal(historyMatchesDates(event,'2026-09-23','2026-09-24'),false);
 assert.equal(historyStaff(event),'Turno fijo · Mecánico');
 assert.ok(historyMatchesSearch(event,'despues del centrado'));
 assert.equal(historyDates({...event,fechaCierre:'2026-10-02'}),'21 SEP 2026 – 2 OCT 2026');
});
test('carga común exige responsables, cierre coherente y duración explícita sin convertirla en pérdida', () => {
 const closed={...event,responsable:'Turno fijo',metadata:{seguimiento:{...event.metadata.seguimiento,captureVersion:2,outcome:'operativa',detentionReason:'Baja presión',availableDate:'2026-09-22'}}};
 assert.doesNotThrow(()=>validateEvent(closed,'2026-09-28'));
 assert.throws(()=>validateEvent({...closed,fechaCierre:null},'2026-09-28'),/cierre/);
 assert.throws(()=>validateEvent({...closed,responsable:'Por confirmar'},'2026-09-28'),/personal/);
 const open={...event,estadoMantenimiento:'en_curso',fechaCierre:null,actualizaciones:[]};
 const update={fecha:'2026-09-28',descripcion:'Se reemplazó la válvula',responsable:'Turno fijo',tipoActualizacion:'cierre',metadata:{seguimiento:{captureVersion:3,activity:'trabajo',period:'Mañana',outcome:'operativa',workDurationDays:.5}}};
 assert.doesNotThrow(()=>validateUpdate(open,update,'2026-09-28'));
 assert.equal(update.metadata.seguimiento.cause,undefined);
 const unknown=structuredClone(update);delete unknown.metadata.seguimiento.workDurationDays;
 assert.throws(()=>validateUpdate(open,unknown,'2026-09-28'),/duración/);
 unknown.metadata.seguimiento.confirmedUnknownDuration=true;
 assert.doesNotThrow(()=>validateUpdate(open,unknown,'2026-09-28'));
 const missing=structuredClone(update);missing.metadata.seguimiento.outcome='';
 assert.throws(()=>validateUpdate(open,missing,'2026-09-28'),/operativa/);
});

test('un avance anterior al cierre conserva su estado histórico al corregirlo', () => {
 const prior={id:'prior',fecha:'2026-09-21',tipoActualizacion:'avance',descripcion:'Continúa el trabajo',responsable:'Turno fijo',metadata:{seguimiento:{activity:'trabajo',period:'Mañana',outcome:'continua'}}};
 const closed={...event,actualizaciones:[prior]};
 assert.doesNotThrow(()=>validateUpdate(closed,prior,'2026-09-29'));
 assert.throws(()=>validateUpdate(closed,{...prior,fecha:'2026-09-22'},'2026-09-29'),/avance anterior/);
 assert.throws(()=>validateUpdate(closed,{...prior,tipoActualizacion:'cierre'},'2026-09-29'),/cierre deja/);
});

test('corregir la ficha tras un cierre conserva la disponibilidad y los planes pendientes', () => {
 const closed={...event,metadata:{seguimiento:{...event.metadata.seguimiento,outcome:'continua',followUpPlan:'Revisar andando en fosa'}}};
 const tracking=trackingForCurrentState(closed);
 assert.equal(tracking.outcome,'operativa');
 assert.equal(tracking.availableDate,'2026-09-22');
 assert.equal(tracking.followUpPlan,'Revisar andando en fosa');
 assert.doesNotThrow(()=>validateEvent({...closed,metadata:{seguimiento:tracking}},'2026-09-29'));
});
test('los partes conocidos conservan media jornada, jornada completa y datos aún pendientes', () => {
 assert.equal(workDurationLabel({workDurationDays:.5}),'Media jornada');
 assert.equal(workDurationLabel({workDurationDays:1}),'Jornada completa');
 const pending={...event,actualizaciones:[{fecha:'2026-09-22',responsable:'Turno fijo',metadata:{seguimiento:{activity:'trabajo',period:'Mañana',outcome:'operativa',diagnosisConfirmed:false,followUpDate:'2026-09-29'}}}]};
 assert.ok(evidenceQuestions(pending).some(q=>q.text.includes('duración')));
 assert.equal(pending.actualizaciones[0].metadata.seguimiento.workDurationDays,undefined);
});
