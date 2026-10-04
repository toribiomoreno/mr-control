import {test,expect} from '@playwright/test';
const date='2026-09-21';
const job=(tipo='correctivo',code=null)=>({id:'job',locomotora_codigo:'E701',fecha:date,hora:'06:00',tipo,preventivo_codigo:code,titulo:'Título original',descripcion:'Descripción original',responsable:tipo==='correctivo'?'Turno fijo':'Turno rotativo',estado_mantenimiento:'en_curso',updated_at:'2026-09-21T09:00:00Z',metadata:{source:'original',seguimiento:{captureVersion:4,detentionStart:date,detentionTime:'06:00',detentionReason:'Motivo único',location:'Externo',plannedStart:date,plannedEnd:'2026-09-25',system:'Sistema eléctrico',subsystem:'Relés y contactores',component:'Contactores',outcome:'continua'}}});
async function setup(page,row,notes=[]){
 const writes=[];
 await page.route('http://127.0.0.1:54321/**',route=>{
  const req=route.request(),url=req.url();
  if(url.includes('seguimiento_version'))return route.fulfill({json:1});
  if(url.includes('adjuntos_evento'))return route.fulfill({json:[]});
  if(url.includes('actualizaciones_evento')){
   if(req.method()==='POST'){const body={...req.postDataJSON(),id:`note-${notes.length}`};notes.push(body);writes.push(body);return route.fulfill({json:body});}
   return route.fulfill({json:notes});
  }
  if(req.method()==='PATCH'){writes.push(req.postDataJSON());Object.assign(row,req.postDataJSON());}
  return route.fulfill({json:[row]});
 });
 await page.goto('/tests/seguimiento.html');await page.getByLabel('Semana del').fill(date);await page.locator('.tracking-bar').click();return writes;
}
test('ficha sin duplicados y edición de ingreso con lista limitada de campos',async({page})=>{
 const row=job();const writes=await setup(page,row);
 await expect(page.locator('.tracking-detail > .modal-heading')).toHaveText(/E701 · Correctivo/);
 await expect(page.locator('.tracking-detail').getByText('Motivo único',{exact:true})).toHaveCount(1);
 await expect(page.locator('.tracking-facts').getByText('Equipo',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Fecha y hora de fin',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Editar datos del mantenimiento',exact:true}).click();
 const form=page.locator('form').filter({has:page.getByRole('group',{name:'Editar datos del mantenimiento'})});
 expect(await form.locator('[name]').evaluateAll(nodes=>nodes.map(n=>n.name))).toEqual(['unit','maintenanceType','reason','startDate','startTime']);
 await form.getByRole('combobox',{name:'Equipo',exact:true}).selectOption('E702');await form.locator('textarea[name="reason"]').fill('Motivo corregido');await form.getByRole('button',{name:'Confirmar datos'}).click();
 await expect(page.getByRole('dialog',{name:'Mantenimiento E702'})).toBeVisible();
 expect(writes).toHaveLength(1);expect(Object.keys(writes[0]).sort()).toEqual(['fecha','hora','locomotora_codigo','metadata','preventivo_codigo','tipo']);expect(row.metadata.seguimiento.location).toBe('Externo');expect(row.metadata.seguimiento.plannedEnd).toBe('2026-09-25');expect(row.descripcion).toBe('Descripción original');
});
test('correctivo y numeral: bloques diarios ordenados, demora condicional y mismo día implícito',async({page})=>{
 for(const [tipo,code] of [['correctivo',null],['preventivo','Numeral 3']]){
  const notes=[{id:'first',evento_id:'job',fecha:date,tipo_actualizacion:'avance',descripcion:'Revisión anterior',responsable:'Turno fijo',metadata:{seguimiento:{activity:'trabajo',outcome:'continua',system:'Sistema eléctrico',subsystem:'Relés y contactores',component:'Contactores',period:'Mañana',workDurationDays:1}}}];
  const writes=await setup(page,job(tipo,code),notes);
  await page.getByRole('button',{name:'+ Otro bloque en este día'}).click();const form=page.getByRole('form',{name:'Registrar avance'});
  await expect(form.locator('input[type="date"]')).toHaveCount(0);await expect(form.getByText(/mismo día del bloque/)).toBeVisible();
  await expect(form.locator('[name="period"],[name="component"],[name="weekendEligible"]')).toHaveCount(0);
  expect(await form.locator('[name]').evaluateAll(n=>n.map(x=>x.name))).toEqual(['system','subsystem','responsable','workDurationDays','descripcion']);
  await form.getByLabel('¿Qué sistema estamos atacando?').selectOption('Sistema eléctrico');await form.getByLabel('Subsistema',{exact:true}).selectOption('Relés y contactores');await form.getByLabel('¿Quién la trabajó?').selectOption('Turno fijo');await form.getByRole('combobox',{name:'Jornada',exact:true}).selectOption('0.5');await form.locator('textarea[name="descripcion"]').fill('Segundo sistema atendido');await form.getByLabel('Estado posterior de la máquina').selectOption('prueba_parque');
  await expect(form.getByLabel('Motivo de la demora')).toHaveCount(0);await form.getByLabel('¿Tuviste alguna demora?').selectOption('yes');await expect(form.getByLabel('Motivo de la demora')).toBeVisible();await form.getByLabel('Motivo de la demora').selectOption('CAP');await form.locator('textarea[name="delayDescription"]').fill('Espera por recurso');await form.getByRole('button',{name:'Guardar avance'}).click();await expect(form).toHaveCount(0);expect(writes).toHaveLength(1);expect(writes[0].metadata.seguimiento.activity).toBe('mixto');expect(writes[0].tipo_actualizacion).toBe('avance');expect(writes[0].fecha).toBe(date);expect(notes).toHaveLength(2);
  await page.getByRole('button',{name:'Cerrar detalle'}).click();await page.unroute('http://127.0.0.1:54321/**');
 }
});
test('AB: resultado del turno agrega extensión con motivo sin campos diarios',async({page})=>{
 const writes=await setup(page,job('preventivo','AB'));
 await page.getByRole('button',{name:'+ Agregar turno o novedad'}).click();const form=page.getByRole('form',{name:'Registrar avance'});
 await expect(form.locator('[name="system"],[name="subsystem"],[name="workDurationDays"],[name="responsable"]')).toHaveCount(0);
 await form.getByLabel('Fecha del turno').fill(date);await form.getByRole('combobox',{name:'Turno',exact:true}).selectOption('2');await form.getByLabel('¿Se pudo trabajar normalmente?').selectOption('no');await form.getByLabel('¿En qué turno se trabajó?').selectOption('Tarde');await form.locator('textarea[name="descripcion"]').fill('Turno trabajado');await form.getByLabel('Resultado del turno').selectOption('extend');await form.getByLabel('Motivo de la demora').selectOption('MAT');await form.locator('textarea[name="delayDescription"]').fill('Faltó material para terminar');await form.getByRole('button',{name:'Guardar avance'}).click();await expect(form).toHaveCount(0);
 expect(writes[0].metadata.seguimiento.additionalShiftRequired).toBe(true);await page.getByRole('button',{name:'+ Agregar turno o novedad'}).click();await expect(form.getByRole('combobox',{name:'Turno',exact:true})).toHaveValue('2');await expect(form.getByText('Turno adicional · extensión 1')).toBeVisible();
});
