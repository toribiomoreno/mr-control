import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLibroCsv, uniqueBookLines } from '../src/domain/maintenance/bookImport.js';

test('libro: normaliza unidades, ordena por fecha/hora y agrupa sin repetir novedades',()=>{
 const csv='Nro;Estado;Fecha;Hora;Tipo;Unidad;Detalle\n12;Abierto;29/09/2026;14:00;LOCOMOTORA;714;LOCOMOTORA:714:Revisión de bancada\n;;;;;;Revisión de bancada\n10;Cerrado;28/09/2026;6:00;LOCOMOTORA;EMO2;"Prueba; sin novedades\nRetorno confirmado"';
 const rows=parseLibroCsv(csv,new Set(['E714','EM02']));
 assert.equal(rows.length,2);assert.equal(rows[0].unidad,'EM02');assert.equal(rows[0].hora,'06:00');assert.match(rows[0].detalles[0],/Prueba; sin novedades\nRetorno/);
 assert.equal(rows[1].unidad,'E714');assert.deepEqual(rows[1].detalles,['Revisión de bancada']);
 assert.equal(uniqueBookLines(['Revisión de bancada','revisión  de bancada']).length,1);
});
test('libro: no descarta silenciosamente fechas o locomotoras desconocidas',()=>{
 const line=detail=>`1;Abierto;${detail};06:00;LOCOMOTORA;701;Ejemplo`;
 assert.throws(()=>parseLibroCsv(line('31/09/2026'),new Set(['E701'])),/Fecha/);
 assert.throws(()=>parseLibroCsv(line('29/09/2026'),new Set(['E714'])),/Unidad/);
 assert.throws(()=>parseLibroCsv(line('29/09/2026')+';"',new Set(['E701'])),/comillas/);
});
