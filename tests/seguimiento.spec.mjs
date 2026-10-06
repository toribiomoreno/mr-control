import { test, expect } from '@playwright/test';
const event={id:'example',locomotora_codigo:'E701',fecha:'2026-09-24',hora:'06:00',tipo:'correctivo',titulo:'Correctivo de prueba',descripcion:'Revisión sintética del componente',responsable:'Turno fijo',estado_mantenimiento:'finalizado',fecha_cierre:'2026-09-25',metadata:{seguimiento:{detentionStart:'2026-09-24',location:'Boulogne',system:'Bogie',component:'Componente de prueba'}}};
const updates=[{id:'first',evento_id:'example',fecha:'2026-09-24',hora:'06:00',tipo_actualizacion:'observacion',descripcion:'Revisión con espera de recurso',responsable:'Turno fijo',metadata:{seguimiento:{activity:'mixto',period:'Mañana',outcome:'continua',cause:'CAP',usefulFraction:.5,allocationNote:'Media jornada de espera'}}},{id:'second',evento_id:'example',fecha:'2026-09-25',hora:'06:00',tipo_actualizacion:'observacion',descripcion:'Trabajo terminado',responsable:'Turno fijo',metadata:{seguimiento:{activity:'trabajo',period:'Mañana'}}}];
test('semana, detalle, eficiencia, corrección y CSV',async({page})=>{
 await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({json:route.request().url().includes('seguimiento_version') ? 1 : route.request().url().includes('actualizaciones_evento') ? updates : [event]}));
 await page.goto('/tests/seguimiento.html');
 await page.getByLabel('Semana del').fill('2026-09-21');
 const bar=page.locator('.tracking-bar');await expect(bar).toHaveCount(1);await expect(bar).toHaveCSS('grid-column-end','span 2');
 await expect(page.getByRole('heading',{name:'Semana 39'})).toBeVisible();
 await page.getByRole('button',{name:'Ver día 24/09/2026',exact:true}).click();
 await expect(page.getByRole('region',{name:'Actividad del 24/09/2026'}).getByText('Revisión con espera de recurso')).toBeVisible();
 await expect(page.getByRole('button',{name:'Eficiencia',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Actualizar',exact:true})).toHaveCount(0);
 await bar.click();await expect(page.getByRole('heading',{name:'Eficiencia del mantenimiento'})).toBeVisible();
 await expect(page.getByText('75 %',{exact:true})).toBeVisible();
 await expect(page.locator('.maintenance-delays, .maintenance-questions')).toHaveCount(0);
 await expect(page.getByText('Estado actual de la locomotora',{exact:true})).toHaveCount(0);
 await expect(page.locator('.maintenance-journal-entry').getByText(/Demora:|50% útil/)).toHaveCount(0);
 await page.locator('.maintenance-journal-entry').first().getByRole('button',{name:/Completar/}).click();
 await expect(page.getByLabel('Fecha de trabajo',{exact:true})).toHaveValue('2026-09-24');
 await expect(page.locator('.modal-backdrop')).toHaveCount(1);
 await expect(page.locator('.maintenance-journal-entry').first().getByRole('form',{name:'Editar avance'})).toBeVisible();
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await expect(page.getByRole('img',{name:'1,5 días útiles, 0,5 perdidos y 0 sin información'})).toBeVisible();
 await page.screenshot({path:'/workspace/scratch/7ec95ebdf471/mantenimiento-detalle.png',fullPage:true});
 await page.locator('.maintenance-efficiency').scrollIntoViewIfNeeded();
 await page.screenshot({path:'/workspace/scratch/7ec95ebdf471/mantenimiento-eficiencia.png',fullPage:true});
 await page.getByRole('button',{name:'Cerrar detalle'}).click();
 await page.getByText('Datos',{exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Indicadores CSV',exact:true}).click();expect((await download).suggestedFilename()).toBe('eficiencia-2026-09-21.csv');
 await page.getByText('Datos',{exact:true}).click();
 await bar.click();await page.locator('.maintenance-journal-entry').first().getByRole('button',{name:'Editar este avance',exact:true}).click();
 await expect(page.getByLabel('¿Tuviste alguna demora?')).toHaveValue('yes');await expect(page.getByLabel('Estado posterior de la máquina')).toHaveValue('continua');
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();await page.getByRole('button',{name:'Cerrar detalle'}).click();
 await page.getByRole('button',{name:'+ Cargar datos'}).click();
 await expect(page.getByRole('button',{name:'Mantenimiento existente',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Otros registros: lavado o alistamiento'})).toHaveCount(0);
 await page.getByLabel('Tipo de mantenimiento').selectOption('E');await expect(page.getByLabel('¿En qué turno se trabajó?')).toBeVisible();await expect(page.getByLabel('¿Qué sistema estamos atacando?')).toHaveCount(0);
 await page.getByLabel('Tipo de mantenimiento').selectOption('Correctivo');await expect(page.getByLabel('¿Qué sistema estamos atacando?')).toBeVisible();
});

test('ingreso seguido de actividad: hora desconocida y media jornada sin pérdida inventada', async({page})=>{
 const rows=[], notes=[];
 await page.route('http://127.0.0.1:54321/**',async route=>{
  const req=route.request(), url=req.url(), method=req.method();
  if(url.includes('seguimiento_version')) return route.fulfill({json:1});
  if(new URL(url).pathname.includes('adjuntos_evento')) return route.fulfill({json:[]});
  if(url.includes('actualizaciones_evento')) {
   if(method==='POST') { const item={...req.postDataJSON(),id:'created-update'}; notes.push(item);return route.fulfill({json:item}); }
   return route.fulfill({json:notes});
  }
  if(method==='POST') { const item={...req.postDataJSON(),id:'created-event'};rows.push(item);return route.fulfill({json:item}); }
  if(method==='PATCH') { Object.assign(rows[0],req.postDataJSON());return route.fulfill({json:rows}); }
  return route.fulfill({json:rows});
 });
 await page.goto('/tests/seguimiento.html');
 await expect(page.getByText('Cargando mantenimientos…')).toHaveCount(0);
 await page.getByRole('button',{name:'+ Cargar datos'}).click();
 const form=page.getByRole('form',{name:'Registrar avance'});
 await form.getByLabel('Tipo de mantenimiento').selectOption('Correctivo');await form.getByLabel('Fecha de ingreso').fill('2026-09-21');await form.getByLabel('Motivo del ingreso').fill('No regulaba la presión.');
 await form.getByLabel('¿Qué sistema estamos atacando?').selectOption('Sistema neumático');await form.getByLabel('Subsistema',{exact:true}).selectOption('Válvulas y presostatos');await form.getByLabel('¿Quién la trabajó?').selectOption('Turno fijo');await form.locator('textarea[name="descripcion"]').fill('Se reemplazó la válvula 26-C.');
 await form.getByRole('combobox',{name:'Jornada',exact:true}).selectOption('0.5');await form.getByLabel('Estado posterior de la máquina').selectOption('operativa');await form.locator('input[name="confirmAvailability"]').check();
 await form.getByRole('button',{name:'Guardar avance',exact:true}).click();await expect(form).toHaveCount(0);
 expect(rows).toHaveLength(1);expect(rows[0].hora).toBeNull();
 expect(notes).toHaveLength(1);expect(notes[0].tipo_actualizacion).toBe('cierre');
 expect(notes[0].metadata.seguimiento.workDurationDays).toBe(.5);
 expect(notes[0].metadata.seguimiento.cause).toBe('');
 expect(notes[0].metadata.seguimiento.usefulFraction).toBeUndefined();
 expect(rows[0].estado_mantenimiento).toBe('finalizado');
});

test('editar el avance en su ficha guarda, cancela y conserva los datos asociados', async({page})=>{
 const current={...event,estado_mantenimiento:'en_curso',fecha_cierre:null,metadata:{seguimiento:{captureVersion:3,detentionStart:'2026-09-24',location:'Boulogne',system:'Bogie',component:'Componente de prueba',detentionReason:'Prueba',outcome:'continua'}}};
 const note={...updates[0],tipo_actualizacion:'avance',updated_at:'2026-09-25T12:00:00Z',pendientes:'Ensayo pendiente',resultado_prueba:'Ensayo parcial',metadata:{sourceId:'synthetic-edit',seguimiento:{...updates[0].metadata.seguimiento,captureVersion:3,workDurationDays:.5,dayComplete:true}}};
 let patches=0;
 await page.route('http://127.0.0.1:54321/**',route=>{
  const req=route.request(),url=req.url();
  if(url.includes('seguimiento_version')) return route.fulfill({json:1});
  if(url.includes('adjuntos_evento')) return route.fulfill({json:[]});
  if(url.includes('actualizaciones_evento')) {
   if(req.method()==='PATCH'){Object.assign(note,req.postDataJSON());patches++;}
   return route.fulfill({json:[note]});
  }
  return route.fulfill({json:[current]});
 });
 await page.goto('/tests/seguimiento.html');
 await page.getByLabel('Semana del').fill('2026-09-21');
 await page.locator('.tracking-bar').click();
 await page.getByRole('button',{name:'Editar este avance'}).click();
 const form=page.getByRole('form',{name:'Editar avance'});
 await expect(page.locator('.modal-backdrop')).toHaveCount(1);
 await form.locator('textarea[name="descripcion"]').fill('Cambio sin guardar');
 await form.getByRole('button',{name:'Cancelar',exact:true}).click();
 expect(patches).toBe(0);
 await expect(page.getByRole('dialog',{name:'Mantenimiento E701'})).toBeVisible();
 await page.getByRole('button',{name:'Editar este avance'}).click();
 await form.locator('textarea[name="descripcion"]').fill('Descripción corregida');

 await form.getByRole('button',{name:'Guardar avance',exact:true}).click();
 await expect(form).toHaveCount(0);
 await expect(page.getByRole('dialog',{name:'Mantenimiento E701'})).toBeVisible();
 await expect(page.locator('.maintenance-journal-entry').getByText('Descripción corregida',{exact:true})).toBeVisible();
 expect(patches).toBe(1);expect(note.pendientes).toBe('Ensayo pendiente');expect(note.resultado_prueba).toBe('Ensayo parcial');expect(note.metadata.seguimiento.dayComplete).toBe(true);expect(note.metadata.seguimiento.usefulFraction).toBe(.5);expect(note.metadata.sourceId).toBe('synthetic-edit');
});
