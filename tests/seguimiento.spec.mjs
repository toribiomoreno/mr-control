import { test, expect } from '@playwright/test';
const event={id:'example',locomotora_codigo:'E701',fecha:'2026-09-24',hora:'06:00',tipo:'correctivo',titulo:'Correctivo de prueba',descripcion:'Revisión sintética del componente',responsable:'Turno fijo',estado_mantenimiento:'finalizado',fecha_cierre:'2026-09-25',metadata:{seguimiento:{detentionStart:'2026-09-24',location:'Boulogne',system:'Bogie',component:'Componente de prueba'}}};
const updates=[{id:'first',evento_id:'example',fecha:'2026-09-24',hora:'06:00',tipo_actualizacion:'observacion',descripcion:'Revisión con espera de recurso',responsable:'Turno fijo',metadata:{seguimiento:{activity:'mixto',period:'Mañana',cause:'CAP',usefulFraction:.5,allocationNote:'Media jornada de espera'}}},{id:'second',evento_id:'example',fecha:'2026-09-25',hora:'06:00',tipo_actualizacion:'observacion',descripcion:'Trabajo terminado',responsable:'Turno fijo',metadata:{seguimiento:{activity:'trabajo',period:'Mañana'}}}];
test('semana, detalle, eficiencia, corrección y CSV',async({page})=>{
 await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({json:route.request().url().includes('seguimiento_version') ? 1 : route.request().url().includes('actualizaciones_evento') ? updates : [event]}));
 await page.goto('/tests/seguimiento.html');
 await page.getByLabel('Semana del').fill('2026-09-21');
 const bar=page.locator('.tracking-bar');await expect(bar).toHaveCount(1);await expect(bar).toHaveCSS('grid-column-end','span 2');
 await bar.click();await expect(page.getByRole('heading',{name:'Eficiencia de toda la intervención: 75 %'})).toBeVisible();
 await page.getByRole('button',{name:'Corregir / completar registro'}).first().click();await expect(page.getByRole('button',{name:'Trabajo y demora',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();await page.getByRole('button',{name:'Cerrar detalle'}).click();
 await page.getByRole('button',{name:'Eficiencia',exact:true}).click();await expect(page.getByText('75 %',{exact:true})).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar eficiencia CSV'}).click();expect((await download).suggestedFilename()).toBe('eficiencia-2026-09-21.csv');
 await page.getByRole('button',{name:'Seguimiento semanal'}).click();await page.screenshot({path:'/workspace/scratch/7ec95ebdf471/mr-integrado-semana.png',fullPage:true});
 await page.getByRole('button',{name:'+ Registrar mantenimiento'}).click();await page.getByLabel('Tipo de evento').selectOption('preventivo');await expect(page.getByText(/Locomotora completa · turno rotativo/)).toBeVisible();
 await expect(page.getByLabel('¿Qué sistema estamos atacando?')).toHaveCount(0);
 await page.getByLabel('Tipo de evento').selectOption('correctivo');await expect(page.getByLabel('¿Qué sistema estamos atacando?')).toBeVisible();
});
