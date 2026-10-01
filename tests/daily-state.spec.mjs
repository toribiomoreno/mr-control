import { test, expect } from '@playwright/test';
import { fleet } from '../src/domain/maintenance/types.js';

test('E701 ordenado y símbolos de trazo homogéneo: rojo, amarillo, violeta y tiza',async({page})=>{
 await page.goto('/tests/state.html?view=chronology');
 await expect(page.locator('.timeline-event-topline strong')).toHaveText(['Novedad · libro de turno','Estado diario de la máquina','Correctivo de prueba','Preventivo E']);
 expect(await page.locator('.history-event-icon svg').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('stroke-width')))).toEqual(['1.8','1.8','1.8','1.8']);
 expect(await page.locator('.history-event-icon svg').evaluateAll(nodes=>nodes.map(n=>n.dataset.icon))).toEqual(['book','daily','wrench','wrench']);
 expect(await page.locator('.history-event-icon').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).color))).toEqual(['rgb(167, 139, 250)','rgb(231, 229, 223)','rgb(239, 68, 68)','rgb(250, 204, 21)']);
 await expect(page.getByText('Hora no informada',{exact:true})).toHaveCount(2);
 await page.locator('.history-timeline').screenshot({path:'/workspace/scratch/7ec95ebdf471/historico-e716-orden-iconos.png'});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('guardado del parte e ingreso automático en un único lote sin avances ni duplicados',async({page})=>{
 let payload;
 await page.route('http://127.0.0.1:54321/rest/v1/**',route=>{
  if(route.request().url().includes('/rpc/seguimiento_version')) return route.fulfill({json:1});
  if(route.request().method()==='POST'){payload=route.request().postDataJSON();return route.fulfill({status:201,body:''});}
  return route.fulfill({json:[]});
 });
 await page.goto('/tests/state.html?view=import-auto');
 await page.getByLabel('Fecha del parte').fill('2026-10-01');
 await page.getByLabel('Contenido del mail').fill('Loc.\tEstado\tObservaciones\n'+fleet.map(c=>`${c}\t${c==='E701'?'Detenida':''}\t${c==='E701'?'Revisión de componente de prueba':''}`).join('\n'));
 await page.getByRole('button',{name:'Procesar',exact:true}).click();
 await expect(page.getByText('Se abrirá el mantenimiento con este motivo.',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Confirmar actualización',exact:true}).click();
 await expect(page.locator('#root')).toHaveAttribute('data-saved','true');
 expect(payload).toHaveLength(28);
 expect(new Set(payload.map(row=>row.id)).size).toBe(28);
 const job=payload.find(row=>row.tipo==='correctivo'),daily=payload.find(row=>row.locomotora_codigo==='E701'&&row.tipo==='otro');
 expect(job.metadata.seguimiento.outcome).toBe('continua');expect(job.metadata.seguimiento.workDurationDays).toBeUndefined();
 expect(daily.metadata.dailyState.maintenanceIds).toEqual([job.id]);expect(daily.metadata.dailyState.needsMaintenance).toBe(false);
});

test('Parque solo consulta e importa partes; faltantes se preguntan al cargar datos',async({page})=>{
 const job={id:'00000000-0000-4000-8000-000000000001',locomotora_codigo:'E714',fecha:'2026-09-30',tipo:'correctivo',titulo:'Revisión sintética de prueba',descripcion:'Revisión sintética de prueba',responsable:'Turno fijo',estado_mantenimiento:'en_curso',metadata:{seguimiento:{detentionStart:'2026-09-30',confirmedThrough:'2026-09-30',location:'Boulogne',system:'Motor diésel',component:'Componente de prueba',detentionReason:'Revisión sintética de prueba',outcome:'continua'}}};
 const daily={id:'00000000-0000-4000-8000-000000000002',locomotora_codigo:'E714',fecha:'2026-10-01',hora:'06:00',tipo:'otro',metadata:{dailyState:{state:'detenida',reportedState:'detenida',observation:'Revisión sintética de prueba',maintenanceIds:[job.id]}}};
 await page.route('http://127.0.0.1:54321/rest/v1/**',route=>{
  const url=route.request().url();
  if(url.includes('/rpc/seguimiento_version')) return route.fulfill({json:1});
  if(url.includes('tipo=eq.otro')) return route.fulfill({json:[daily]});
  if(url.includes('eventos_historial')) return route.fulfill({json:[job]});
  return route.fulfill({json:[]});
 });
 await page.goto('/tests/state.html?view=app');
 await page.getByRole('button',{name:'Parque',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Parque ferroviario'})).toBeVisible();
 await expect(page.getByText('Disponibilidad por confirmar',{exact:false})).toHaveCount(0);
 await page.locator('.locomotive-unit').filter({hasText:'E714'}).click();
 await expect(page.locator('.side-panel').getByRole('heading',{name:'E714'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Iniciar nuevo mantenimiento'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Revisar estado pendiente'})).toHaveCount(0);
 await page.getByRole('button',{name:'Mantenimientos',exact:true}).click();
 await page.getByRole('button',{name:'+ Cargar datos',exact:true}).click();
 await page.getByLabel('Mantenimiento existente').selectOption(job.id);
 await expect(page.getByRole('region',{name:'Información por completar'})).toContainText('¿Qué ocurrió el 30/09/2026?');
 await page.screenshot({path:'/workspace/scratch/7ec95ebdf471/carga-datos-preguntas.png'});
});

test('estado diario y libro como novedades cronológicas sin repetir observaciones',async({page})=>{
 await page.goto('/tests/state.html');
 await expect(page.locator('.timeline-date').first()).toHaveText('7 ENE 2020');
 await expect(page.getByText('Estado diario de la máquina',{exact:true})).toBeVisible();
 await expect(page.getByText('06:00 h',{exact:true})).toBeVisible();
 await expect(page.getByText('Sale acompañada',{exact:true})).toHaveCount(1);
 await expect(page.getByText('Novedad · libro de turno',{exact:true})).toBeVisible();
 await expect(page.getByText('Se revisó la novedad del eje.')).toBeVisible();
 await page.getByRole('button',{name:'Estados diarios',exact:true}).click();await expect(page.locator('.timeline-event-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Todos',exact:true}).click();
 await page.locator('.history-timeline').screenshot({path:'/workspace/scratch/7ec95ebdf471/estados-diarios-preview.png'});
});
test('importación espera el guardado y no cierra ni simula éxito ante un error',async({page})=>{
 await page.goto('/tests/state.html?view=import');
 await expect(page.getByLabel('Hora del parte')).toHaveValue('06:00');
 await page.getByLabel('Fecha del parte').fill('2026-09-30');
 await page.getByLabel('Contenido del mail').fill('Loc.\tEstado\tObservaciones\n'+fleet.map(c=>`${c}\t\t${c==='E701'?'Sale acompañada':''}`).join('\n'));
 await page.getByRole('button',{name:'Procesar',exact:true}).click();
 await expect(page.getByRole('row').filter({hasText:'E701'}).getByRole('cell').nth(2)).toHaveText('Operativa');
 await page.getByRole('button',{name:'Confirmar actualización',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveText('Falla de guardado de prueba');await expect(page.getByRole('heading',{name:'Importar estado diario'})).toBeVisible();
});
test('consulta guiada guarda el resultado en el origen y conserva el aviso si falla',async({page})=>{
 let body;
 await page.route('http://127.0.0.1:54321/rest/v1/**',route=>{
   const url=route.request().url();
   if(url.includes('/rpc/seguimiento_version')) return route.fulfill({json:1});
   if(route.request().method()==='POST') { body=route.request().postDataJSON();return route.fulfill({status:409,json:{message:'La consulta ya fue respondida'}}); }
   if(url.includes('tipo=eq.otro')) return route.fulfill({json:[{id:'daily1',locomotora_codigo:'E701',fecha:'2020-01-07',hora:'06:00',tipo:'otro',metadata:{dailyState:{state:'operativa',reportedState:'operativa',observation:'Sale acompañada'}}}]});
   return route.fulfill({json:[]});
 });
 await page.goto('/tests/state.html?view=pending');
 await page.getByRole('button',{name:'Registrar resultado',exact:true}).click();
 await page.getByRole('button',{name:'Sin novedades · operativa',exact:true}).click();
 await page.getByRole('button',{name:'Guardar resultado',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveText('La consulta ya fue respondida');
 expect(body.metadata.followUpResult.key).toBe('parte:daily1');expect(body.metadata.followUpResult.result).toBe('sin_novedades');expect(body.descripcion).toContain('Regresó');
});
