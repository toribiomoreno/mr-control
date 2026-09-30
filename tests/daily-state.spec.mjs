import { test, expect } from '@playwright/test';
import { fleet } from '../src/domain/maintenance/types.js';

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
