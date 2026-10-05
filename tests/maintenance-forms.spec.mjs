import {test,expect} from '@playwright/test';
const date='2026-09-21';
const job=(tipo='correctivo',code=null)=>({id:'job',locomotora_codigo:'E701',fecha:date,hora:'06:00',tipo,preventivo_codigo:code,titulo:'Título original',descripcion:'Descripción original',responsable:tipo==='correctivo'?'Turno fijo':'Turno rotativo',estado_mantenimiento:'en_curso',updated_at:'2026-09-21T09:00:00Z',metadata:{source:'original',seguimiento:{captureVersion:4,detentionStart:date,detentionTime:'06:00',detentionReason:'Motivo único',location:'Externo',plannedStart:date,plannedEnd:'2026-09-25',system:'Sistema eléctrico',subsystem:'Relés y contactores',component:'Contactores',outcome:'continua'}}});
async function setup(page,row,notes=[]){
 const writes=[];
 await page.route('http://127.0.0.1:54321/**',route=>{
  const req=route.request(),url=req.url();
  if(url.includes('seguimiento_version'))return route.fulfill({json:1});
  if(new URL(url).pathname.includes('adjuntos_evento'))return route.fulfill({json:[]});
  if(url.includes('actualizaciones_evento')){
   if(req.method()==='POST'){const body={...req.postDataJSON(),id:`note-${notes.length}`};notes.push(body);writes.push(body);return route.fulfill({json:body});}
   if(req.method()==='PATCH'){const note=notes.find(a=>new URL(url).searchParams.get('id')===`eq.${a.id}`);const patch=req.postDataJSON();Object.assign(note,patch);writes.push(patch);return route.fulfill({json:note});}
   return route.fulfill({json:notes});
  }
  if(req.method()==='PATCH'){writes.push(req.postDataJSON());Object.assign(row,req.postDataJSON());}
  return route.fulfill({json:[row]});
 });
 await page.goto('/tests/seguimiento.html');await page.getByLabel('Semana del').fill(date);await page.locator('.tracking-bar').click();return writes;
}
test('ficha sin duplicados y edición de ingreso con lista limitada de campos',async({page})=>{
 const row=job();const writes=await setup(page,row);
 await expect(page.locator('.tracking-detail > .modal-heading')).toHaveText(/E701 - Correctivo/);
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
  const notes=[{id:'first',evento_id:'job',fecha:date,tipo_actualizacion:'avance',descripcion:'Revisión anterior',responsable:'Turno fijo',metadata:{seguimiento:{activity:'trabajo',outcome:'continua',system:'Sistema eléctrico',subsystem:'Relés y contactores',component:'Relés y contactores',period:'Mañana',workDurationDays:1}}}];
  const writes=await setup(page,job(tipo,code),notes);
  await expect(page.locator('.journal-day-group .maintenance-journal-date')).toHaveCount(0);await expect(page.locator('.journal-system')).toHaveText('Sistema eléctrico · Relés y contactores');await page.getByRole('button',{name:'+ Otros trabajos realizados en este día'}).click();const form=page.getByRole('form',{name:'Registrar avance'});
  await expect(page.locator('.journal-day-group').getByRole('form',{name:'Registrar avance'})).toBeVisible();await expect(form.locator('input[type="date"]')).toHaveCount(0);await expect(form.getByText(/mismo día del bloque/)).toBeVisible();
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
test('nuevo día comparte el editor y confirma continuidad anterior sin liberar la máquina',async({page})=>{
 const notes=[{id:'old',evento_id:'job',fecha:date,tipo_actualizacion:'avance',descripcion:'Compresor revisado',responsable:'Turno fijo',metadata:{seguimiento:{activity:'trabajo',outcome:'pendiente',system:'Sistema eléctrico',subsystem:'Relés y contactores',component:'Relés y contactores',period:'Mañana',workDurationDays:1}}}];
 const writes=await setup(page,job(),notes);await page.getByRole('button',{name:'+ Agregar día de trabajo',exact:true}).click();const form=page.getByRole('form',{name:'Registrar avance'});
 await expect(page.locator('.maintenance-journal-entry.grouped').getByRole('form',{name:'Registrar avance'})).toBeVisible();await form.getByLabel('Fecha de trabajo',{exact:true}).fill('2026-09-22');await form.getByLabel('¿Quién la trabajó?').selectOption('Turno fijo');await form.getByRole('combobox',{name:'Jornada',exact:true}).selectOption('1');await form.locator('textarea[name="descripcion"]').fill('Trabajo del día siguiente');await form.getByLabel('¿Tuviste alguna demora?').selectOption('no');await form.getByRole('button',{name:'Guardar avance'}).click();await expect(form).toHaveCount(0);
 expect(writes[0].tipo_actualizacion).toBe('avance');expect(writes[0].metadata.seguimiento.outcome).toBe('pendiente');await expect(page.getByRole('region',{name:'Día 1 · 21/09/2026'}).locator('.journal-outcome')).toContainText('Continúa el mantenimiento');await expect(page.getByRole('region',{name:'Día 2 · 22/09/2026'}).locator('.journal-outcome')).toContainText('Por confirmar');
});
test('AB iniciado por la tarde calcula el fin y ofrece sólo los dos turnos permitidos',async({page})=>{
 const row=job('preventivo','AB'),notes=[{id:'first',evento_id:'job',fecha:date,tipo_actualizacion:'avance',descripcion:'Primer turno',responsable:'Turno rotativo',metadata:{seguimiento:{activity:'trabajo',outcome:'continua',shiftNumber:1,shiftFinished:true,period:'Tarde',workDurationShifts:1}}}];await setup(page,row,notes);
 await expect(page.locator('.tracking-facts').getByText('22/09/2026 · Turno tarde · 22:00',{exact:true})).toBeVisible();await page.getByRole('button',{name:'+ Agregar turno o novedad'}).click();expect(await page.locator('select[name="period"] option').allTextContents()).toEqual(['Seleccionar','Mañana','Tarde']);
});

test('Cargar datos usa la ficha común con ingreso al principio y guarda ingreso y trabajo juntos',async({page})=>{
 const rows=[],notes=[];
 await page.route('http://127.0.0.1:54321/**',route=>{
  const req=route.request(),url=req.url();
  if(url.includes('seguimiento_version'))return route.fulfill({json:1});
  if(new URL(url).pathname.includes('adjuntos_evento'))return route.fulfill({json:[]});
  if(url.includes('actualizaciones_evento')){
   if(req.method()==='POST'){const row={...req.postDataJSON(),id:'progress'};notes.push(row);return route.fulfill({json:row});}
   return route.fulfill({json:notes});
  }
  if(req.method()==='POST'){const row={...req.postDataJSON(),id:'intake'};rows.push(row);return route.fulfill({json:row});}
  if(req.method()==='PATCH')Object.assign(rows[0],req.postDataJSON());
  return route.fulfill({json:rows});
 });
 await page.goto('/tests/seguimiento.html');await page.getByRole('button',{name:'+ Cargar datos'}).click();
 const form=page.getByRole('form',{name:'Registrar avance'});
 const fields=await form.locator('[name]').evaluateAll(nodes=>nodes.map(n=>n.name));
 expect(fields.slice(0,5)).toEqual(['unit','maintenanceType','reason','startDate','startTime']);
 expect(fields.slice(5)).toEqual(['fecha','system','subsystem','responsable','workDurationDays','descripcion']);
 await form.getByRole('combobox',{name:'Equipo',exact:true}).selectOption('E702');await form.getByLabel('Motivo del ingreso').fill('Falla eléctrica');await form.getByLabel('Fecha de ingreso').fill(date);
 await expect(form.getByLabel('Fecha de trabajo',{exact:true})).toHaveValue(date);
 await form.getByLabel('¿Qué sistema estamos atacando?').selectOption('Sistema eléctrico');await form.getByLabel('Subsistema',{exact:true}).selectOption('Relés y contactores');await form.getByLabel('¿Quién la trabajó?').selectOption('Turno fijo');await form.getByRole('combobox',{name:'Jornada',exact:true}).selectOption('0.5');await form.locator('textarea[name="descripcion"]').fill('Contactores revisados');await form.getByLabel('¿Tuviste alguna demora?').selectOption('no');await form.getByLabel('Estado posterior de la máquina').selectOption('operativa');await form.locator('input[name="confirmAvailability"]').check();
 await page.screenshot({path:'/workspace/scratch/7ec95ebdf471/ficha-unificada.png',fullPage:true});
 await form.getByRole('button',{name:'Guardar avance',exact:true}).click();await expect(page.getByRole('dialog',{name:'Cargar datos',exact:true})).toHaveCount(0);
 expect(rows).toHaveLength(1);expect(notes).toHaveLength(1);expect(rows[0].locomotora_codigo).toBe('E702');expect(rows[0].descripcion).toBe('Falla eléctrica');expect(rows[0].estado_mantenimiento).toBe('finalizado');expect(notes[0].descripcion).toBe('Contactores revisados');expect(notes[0].tipo_actualizacion).toBe('cierre');expect(notes[0].metadata.seguimiento.workDurationDays).toBe(.5);
});
test('mantenimiento cerrado: otros trabajos y nuevo día muestran los mismos campos que editar',async({page})=>{
 const row={...job(),estado_mantenimiento:'finalizado',fecha_cierre:'2026-09-23'},notes=[{id:'old',evento_id:'job',fecha:date,tipo_actualizacion:'observacion',descripcion:'Trabajo anterior',responsable:'Turno fijo',metadata:{seguimiento:{activity:'trabajo',outcome:'continua',system:'Sistema eléctrico',subsystem:'Relés y contactores',component:'Relés y contactores',period:'Mañana',workDurationDays:1}}}];
 const writes=await setup(page,row,notes);
 await page.getByRole('button',{name:'Editar este avance'}).click();const edit=page.getByRole('form',{name:'Editar avance'});const fields=await edit.locator('[name]').evaluateAll(nodes=>nodes.map(n=>n.name));await edit.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByRole('button',{name:'+ Agregar día de trabajo',exact:true}).click();let form=page.getByRole('form',{name:'Registrar avance'});expect(await form.locator('[name]').evaluateAll(nodes=>nodes.map(n=>n.name))).toEqual(fields);await form.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByRole('button',{name:'+ Otros trabajos realizados en este día'}).click();form=page.getByRole('form',{name:'Registrar avance'});expect(await form.locator('[name]').evaluateAll(nodes=>nodes.map(n=>n.name))).toEqual(fields.filter(name=>name!=='fecha'));
 await form.getByLabel('¿Quién la trabajó?').selectOption('Turno fijo');await form.getByRole('combobox',{name:'Jornada',exact:true}).selectOption('0.5');await form.locator('textarea[name="descripcion"]').fill('Otro trabajo histórico');await form.getByLabel('¿Tuviste alguna demora?').selectOption('no');await form.getByLabel('Estado posterior de la máquina').selectOption('continua');await form.getByRole('button',{name:'Guardar avance'}).click();await expect(form).toHaveCount(0);
 expect(writes[0].tipo_actualizacion).toBe('observacion');expect(writes[0].metadata.seguimiento.activity).toBe('trabajo');expect(row.estado_mantenimiento).toBe('finalizado');expect(row.fecha_cierre).toBe('2026-09-23');expect(notes).toHaveLength(2);
});
test('ficha nueva adapta la misma carga a preventivo liviano y numeral en móvil',async({page})=>{
 await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({json:route.request().url().includes('seguimiento_version')?1:[]}));
 await page.setViewportSize({width:390,height:844});await page.goto('/tests/seguimiento.html');await page.getByRole('button',{name:'+ Cargar datos'}).click();const form=page.getByRole('form',{name:'Registrar avance'});
 await form.getByLabel('Tipo de mantenimiento').selectOption('AB');await expect(form.getByLabel('Motivo del ingreso')).toHaveValue('Kilometraje');await expect(form.getByLabel('Motivo del ingreso')).toHaveAttribute('readonly','');await expect(form.getByLabel('¿Se pudo trabajar normalmente?')).toHaveValue('no');await expect(form.getByLabel('¿En qué turno se trabajó?')).toBeVisible();await expect(form.locator('[name="system"]')).toHaveCount(0);await expect(form.getByLabel('Resultado del turno')).toBeVisible();
 await form.getByLabel('Tipo de mantenimiento').selectOption('Numeral 3');await expect(form.getByRole('combobox',{name:'Jornada',exact:true})).toBeVisible();await expect(form.getByLabel('¿En qué turno se trabajó?')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('tablero eléctrico disponible en carga y CSV semanal con fechas agrupadas',async({page})=>{
 const notes=[{id:'board',evento_id:'job',fecha:date,tipo_actualizacion:'avance',descripcion:'Limpieza de tablero.',responsable:'Turno fijo',metadata:{seguimiento:{activity:'trabajo',system:'Sistema eléctrico',subsystem:'Tablero eléctrico',component:'Tablero eléctrico',workDurationDays:1}}}];
 await setup(page,job(),notes);await page.getByRole('button',{name:'+ Agregar día de trabajo',exact:true}).click();const form=page.getByRole('form',{name:'Registrar avance'});
 await form.getByLabel('¿Qué sistema estamos atacando?').selectOption('Sistema eléctrico');await form.getByLabel('Subsistema',{exact:true}).selectOption('Tablero eléctrico');await expect(form.getByLabel('¿Tuviste alguna demora?')).toHaveValue('no');await form.getByRole('button',{name:'Cancelar',exact:true}).click();await page.getByRole('button',{name:'Cerrar detalle'}).click();
 await page.locator('.maintenance-export summary').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'CSV de la semana',exact:true}).click();const download=await pending;const stream=await download.createReadStream();let text='';for await(const chunk of stream)text+=chunk.toString('utf8');
 const lines=text.split('\r\n');expect(lines[0].replace(/^\uFEFF/,'').split(';')).toEqual(['Semana','Máquina','Tipo de mantenimiento','Motivo','Fecha de detención','Fecha del día trabajado','Fecha de fin','Fecha de fin programada','Trabajo realizado','¿Hubo demora?','Causa raíz de la demora','Motivo u observación de la demora','Estado al finalizar el día','Sistema','Subsistema'].map(v=>`"${v}"`));expect(lines[1]).toContain('"Limpieza de tablero.";"No";""');expect(lines[1]).toContain('"Sistema eléctrico";"Tablero eléctrico"');
});
test('A cerrado: editar turno 2 y completar trabajos de ese turno conserva el cierre',async({page})=>{
 const row={...job('preventivo','A'),estado_mantenimiento:'finalizado',fecha_cierre:date},notes=[
  {id:'morning',evento_id:'job',fecha:date,tipo_actualizacion:'avance',descripcion:'Sin novedad',responsable:'Turno rotativo',metadata:{seguimiento:{activity:'trabajo',outcome:'continua',period:'Mañana',shiftNumber:1,shiftFinished:true,delayReported:false}}},
  {id:'closing',evento_id:'job',fecha:date,tipo_actualizacion:'cierre',descripcion:'Cambio de portaescobillas',responsable:'Turno rotativo',metadata:{seguimiento:{activity:'trabajo',outcome:'operativa',outcomeConfirmed:true,period:'Tarde',shiftNumber:2,shiftFinished:true,delayReported:false}}}
 ];const writes=await setup(page,row,notes);
 await page.getByRole('region',{name:'Turno 2',exact:true}).getByRole('button',{name:'Editar este avance'}).click();
 const edit=page.getByRole('form',{name:'Editar avance'});await edit.locator('textarea[name="descripcion"]').fill('Cambio de portaescobillas y verificación');await edit.getByRole('button',{name:'Guardar avance'}).click();await expect(edit).toHaveCount(0);
 expect(notes[1].descripcion).toBe('Cambio de portaescobillas y verificación');expect(notes[1].tipo_actualizacion).toBe('cierre');expect(row.fecha_cierre).toBe(date);
 await page.getByRole('button',{name:'+ Agregar turno o novedad'}).click();const form=page.getByRole('form',{name:'Registrar avance'});
 await form.getByLabel('Fecha del turno').fill(date);await form.getByRole('combobox',{name:'Turno',exact:true}).selectOption('2');await form.getByLabel('¿Se pudo trabajar normalmente?').selectOption('yes');await form.getByLabel('¿En qué turno se trabajó?').selectOption('Tarde');await form.locator('textarea[name="descripcion"]').fill('Detalle histórico adicional');await form.getByLabel('Resultado del turno').selectOption('finished');await form.getByLabel('Motivo de la demora').selectOption('Man');await form.locator('textarea[name="delayDescription"]').fill('Maniobras durante el turno');
 await expect(form.getByLabel('Estado posterior de la máquina')).toHaveCount(0);await form.getByRole('button',{name:'Guardar avance'}).click();await expect(form).toHaveCount(0);
 expect(writes[1].tipo_actualizacion).toBe('observacion');expect(writes[1].estado_resultante).toBeNull();expect(row.estado_mantenimiento).toBe('finalizado');expect(row.fecha_cierre).toBe(date);expect(notes).toHaveLength(3);
});
test('mantenimiento externo no solicita avances diarios ni duraciones faltantes',async({page})=>{
 const row=job('preventivo','Numeral 8');row.locomotora_codigo='E704';await setup(page,row);await page.getByRole('button',{name:'Cerrar detalle'}).click();await page.getByRole('button',{name:'+ Cargar datos'}).click();await page.getByRole('button',{name:'Mantenimiento existente',exact:true}).click();await page.getByLabel('Mantenimiento existente').selectOption('job');
 await expect(page.getByText('Mantenimiento externo: no se solicitan avances diarios. Se conservan los datos de ingreso y cierre.')).toBeVisible();await expect(page.getByRole('region',{name:'Información por completar'})).toHaveCount(0);
});
test('locomotora de carga legible en móvil y movimiento reducido',async({page})=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('http://127.0.0.1:54321/**',async route=>{await gate;await route.fulfill({json:route.request().url().includes('seguimiento_version')?1:[]});});
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/tests/seguimiento.html');
 try{await expect(page.getByRole('status')).toContainText('Cargando mantenimientos');await expect(page.locator('.railway-loader-train')).toHaveCSS('animation-name','none');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'/workspace/scratch/7ec95ebdf471/locomotora-carga.png'});}finally{release();}
});
