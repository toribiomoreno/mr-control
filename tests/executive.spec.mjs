import {test,expect} from '@playwright/test';
import {fleet} from '../src/domain/maintenance/types.js';
const date='2026-09-21';
const daily=fleet.map((code,i)=>({id:`daily-${code}`,locomotora_codigo:code,tipo:'otro',fecha:date,hora:'06:00',descripcion:'Observación de prueba',metadata:{dailyState:{state:i<16?'operativa':'reserva',reportedState:i<16?'operativa':'reserva',observation:'Observación de prueba'}}}));

test('Inicio unifica disponibilidad, filtros, histórico y dos bloques con cierre confirmado',async({page})=>{
 const jobs=[], notes=[];
 await page.route('http://127.0.0.1:54321/**',route=>{
  const req=route.request(),url=new URL(req.url()),body=req.postDataJSON?.();
  if(url.pathname.includes('seguimiento_version'))return route.fulfill({json:1});
  if(url.pathname.includes('adjuntos_evento'))return route.fulfill({json:[]});
  if(url.pathname.includes('actualizaciones_evento')){
   if(req.method()==='POST'){const note={...body,id:`note-${notes.length}`,created_at:new Date().toISOString()};notes.push(note);return route.fulfill({json:note});}
   return route.fulfill({json:notes});
  }
  if(req.method()==='POST'){const job={...body,id:'new-job'};jobs.push(job);return route.fulfill({json:job});}
  if(req.method()==='PATCH'){Object.assign(jobs[0],body);return route.fulfill({json:jobs});}
  if(url.searchParams.get('tipo')==='eq.otro')return route.fulfill({json:daily});
  if(url.searchParams.has('locomotora_codigo'))return route.fulfill({json:[...jobs,...daily.filter(d=>d.locomotora_codigo==='E701'),{id:'alist',tipo:'alistamiento',locomotora_codigo:'E701',fecha:date,hora:'05:00',descripcion:'Alistamiento sintético',metadata:{}}]});
  return route.fulfill({json:jobs});
 });
 await page.goto('/tests/state.html?view=app');
 await expect(page.locator('.fleet-big-number strong')).toHaveText('16');
 await expect(page.locator('.fleet-unit')).toHaveCount(27);
 await expect(page.getByRole('table',{name:'Listado del parque tractivo'})).toBeVisible();
 await expect(page.getByRole('columnheader')).toHaveText(['Locomotora','Estado','Observación','Archivo histórico']);
 await page.locator('.fleet-accordion-tractive > summary').click();
 await expect(page.getByRole('table',{name:'Listado del parque tractivo'})).toBeHidden();
 await expect(page.locator('.fleet-big-number strong')).toHaveText('16');
 await page.locator('.fleet-accordion-tractive > summary').click();
 await expect(page.getByRole('button',{name:'Parque',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Operativas16',exact:true}).click();await expect(page.locator('.fleet-unit')).toHaveCount(16);
 await page.getByRole('button',{name:'Mantenimientos',exact:true}).click();
 await page.getByRole('button',{name:'+ Cargar datos',exact:true}).click();await page.getByRole('button',{name:'Otros registros: lavado o alistamiento'}).click();
 await page.getByRole('combobox',{name:'Locomotora',exact:true}).last().selectOption('E701');
 await page.getByLabel('Fecha',{exact:true}).fill(date);await page.getByLabel('Tipo de evento').selectOption('correctivo');
 await page.getByLabel('Trabajo o intervención (título breve)').fill('Correctivo sintético');await page.locator('select[name="especialidad"]').selectOption('Mecanica');await page.getByLabel('Quien lo ataco').selectOption('Turno fijo');await page.locator('textarea[name="descripcion"]').fill('Revisión sintética de inyectores');
 await page.getByLabel('¿Desde cuándo quedó detenida para esta intervención?').fill(date);await page.getByLabel('Hora de detención (si se conoce)').fill('10:00');await page.locator('textarea[name="detentionReason"]').fill('Falla de prueba');await page.getByLabel('¿Qué sistema estamos atacando?').selectOption('Motor diésel');await page.getByLabel('Subsistema',{exact:true}).selectOption('Inyectores');await page.getByLabel('¿Cómo queda la máquina después de este registro?').selectOption('continua');await page.getByLabel('Confirmo la locomotora, fechas, tipo y responsable que estoy cargando.').check();await page.getByRole('button',{name:'Guardar evento',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Completar actividad del registro creado'})).toBeVisible();await page.getByLabel('¿Tuviste alguna demora?').selectOption('no');await page.getByLabel('¿Quién la trabajó?').selectOption('Turno fijo');await page.getByRole('combobox',{name:'Jornada',exact:true}).selectOption('1');await page.getByLabel('Estado posterior de la máquina').selectOption('prueba_parque');await page.getByRole('button',{name:'Guardar avance',exact:true}).click();await expect(page.getByRole('form',{name:'Registrar avance'})).toHaveCount(0);
 await page.getByRole('button',{name:'Cerrar detalle'}).click();await page.getByRole('button',{name:'Inicio',exact:true}).click();await expect(page.locator('.fleet-big-number strong')).toHaveText('15');await expect(page.locator('.fleet-unit').filter({hasText:'E701'})).toContainText('Detenida');await page.locator('.fleet-unit').filter({hasText:'E701'}).dblclick();
 await expect(page.getByRole('heading',{name:'Archivo Histórico · Locomotora E701'})).toBeVisible();await expect(page.getByText('Estado diario de la máquina',{exact:true})).toHaveCount(0);await expect(page.getByText('E701 · Alistamiento',{exact:true})).toBeVisible();await expect(page.getByText('05:00 h',{exact:true})).toBeVisible();await expect(page.locator('.history-state-badge')).toContainText('Detenida');
 await page.getByRole('button',{name:'Abrir mantenimiento',exact:true}).click();await page.getByRole('button',{name:'+ Otros trabajos realizados en este día',exact:true}).click();await page.getByLabel('¿Tuviste alguna demora?').selectOption('no');await page.getByLabel('¿Quién la trabajó?').selectOption('Turno fijo');await page.locator('textarea[name="descripcion"]').fill('Prueba completada sin novedades');await page.getByLabel('¿Qué sistema estamos atacando?').selectOption('Sistema eléctrico');await page.getByLabel('Subsistema',{exact:true}).selectOption('Generador auxiliar');await page.getByRole('combobox',{name:'Jornada',exact:true}).selectOption('0.5');await page.getByLabel('Estado posterior de la máquina').selectOption('operativa');
 await page.getByRole('button',{name:'Guardar avance',exact:true}).click();expect(notes).toHaveLength(1);
 await page.locator('input[name="confirmAvailability"]').check();await page.getByLabel('Hora de fin (si se conoce)').fill('14:30');await page.getByRole('button',{name:'Guardar avance',exact:true}).click();await expect(page.getByRole('form',{name:'Registrar avance'})).toHaveCount(0);await expect(page.locator('.journal-day-group')).toHaveCount(1);await expect(page.locator('.maintenance-journal-entry')).toHaveCount(2);expect(notes).toHaveLength(2);expect(jobs[0].estado_mantenimiento).toBe('finalizado');expect(jobs[0].hora_cierre).toBe('14:30');
 await page.getByRole('button',{name:'Cerrar detalle'}).click();await page.getByRole('button',{name:'Inicio',exact:true}).click();await expect(page.locator('.fleet-big-number strong')).toHaveText('16');
 await page.locator('.home-modules').screenshot({path:'/tmp/mr-inicio-verificado.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('.home-modules').screenshot({path:'/tmp/mr-inicio-movil.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('preventivo AB presenta turnos extendidos, programación y ficha pendiente',async({page})=>{
 const event={id:'ab',locomotora_codigo:'E701',fecha:date,tipo:'preventivo',preventivo_codigo:'AB',titulo:'Preventivo AB',responsable:'Turno rotativo',estado_mantenimiento:'finalizado',fecha_cierre:'2026-09-23',metadata:{seguimiento:{detentionStart:date,location:'Boulogne',plannedStart:date,plannedEnd:'2026-09-22',outcome:'operativa'}}};
 const notes=[[1,false,date],[2,false,date],[2,true,'2026-09-22'],[3,false,'2026-09-23']].map(([shift,extended,d],i)=>({id:`shift-${i}`,evento_id:'ab',fecha:d,hora:i===1?'14:00':'06:00',descripcion:'Trabajo sintético del turno',responsable:'Turno rotativo',tipo_actualizacion:'observacion',metadata:{seguimiento:{shiftNumber:shift,shiftExtended:extended,activity:'trabajo',period:i===1?'Tarde':'Mañana',outcome:i===3?'operativa':'continua'}}}));
 await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({json:route.request().url().includes('seguimiento_version')?1:route.request().url().includes('actualizaciones_evento')?notes:route.request().url().includes('adjuntos_evento')?[]:[event]}));
 await page.goto('/tests/seguimiento.html');await page.getByLabel('Semana del').fill(date);await page.locator('.tracking-bar').click();await expect(page.locator('.journal-day-group h4')).toHaveText(['Turno 1 · 21/09/2026','Turno 2 · 21/09/2026','Turno 2 extendido · 22/09/2026','Turno 3 · 23/09/2026']);await expect(page.locator('.shift-efficiency strong')).toHaveText('75 %');await expect(page.getByText('Fin programado',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Ficha del mantenimiento',exact:true}).click();await expect(page.getByRole('dialog',{name:'Ficha del mantenimiento'})).toContainText('No hay una ficha cargada');await page.getByRole('button',{name:'Cerrar ficha'}).click();await page.screenshot({path:'/tmp/mr-turnos-verificados.png',fullPage:true});
});
