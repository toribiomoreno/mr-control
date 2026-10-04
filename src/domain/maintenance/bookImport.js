import { normalizeUnit } from './types.js';

// CSV con ;, comillas escapadas y notas de varias líneas dentro de una celda.
function csvRows(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  const source = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && char === ';') { row.push(cell.trim()); cell = ''; }
    else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(cell.trim()); rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('El CSV contiene una celda con comillas sin cerrar.');
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}
function dateValue(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  const date = match ? `${match[3].length === 2 ? '20' : ''}${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error(`Fecha del libro inválida: ${raw || 'vacía'}.`);
  return date;
}
export const uniqueBookLines = lines => [...new Map(lines.map(line => String(line || '').trim()).filter(Boolean).map(line => [line.replace(/\s+/g, ' ').toLocaleLowerCase('es'), line])).values()];
export function parseLibroCsv(csvText, activeCodes) {
  const groups = new Map();
  let current = { nro: '', estado: '', fecha: '', hora: '', tipoUnidad: '', unidad: '' };
  for (const cells of csvRows(csvText)) {
    const [nro, estado, fecha, hora, tipoUnidad, unidad, detalle] = cells;
    if (nro) current = { nro, estado: estado || '', fecha: fecha || '', hora: hora || '', tipoUnidad: tipoUnidad || '', unidad: unidad || '' };
    else current = { ...current, estado: estado || current.estado, fecha: fecha || current.fecha, hora: hora || current.hora, tipoUnidad: tipoUnidad || current.tipoUnidad, unidad: unidad || current.unidad };
    if (!/^\d+$/.test(current.nro) || current.tipoUnidad.toUpperCase() !== 'LOCOMOTORA' || !detalle?.trim()) continue;
    const code = normalizeUnit(current.unidad);
    if (!activeCodes.has(code)) throw new Error(`Unidad del libro no reconocida: ${current.unidad} (registro ${current.nro}).`);
    const normalizedDate = dateValue(current.fecha);
    const timeMatch = current.hora.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!timeMatch || Number(timeMatch[1]) > 23 || Number(timeMatch[2]) > 59) throw new Error(`Hora del libro inválida (registro ${current.nro}).`);
    const normalizedTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    const key = `${current.nro}|${normalizedDate}|${normalizedTime}|${code}`;
    const item = groups.get(key) || { nro: current.nro, estado: current.estado, fecha: normalizedDate, hora: normalizedTime, unidad: code, detalles: [] };
    item.detalles.push(detalle.replace(/^LOCOMOTORA\s*:\s*(?:E?\d{3,4}|EM\d{1,2})\s*:\s*/i, '').trim()); groups.set(key, item);
  }
  return [...groups.values()].map(item => ({ ...item, detalles: uniqueBookLines(item.detalles) }))
    .sort((a, b) => `${a.fecha} ${a.hora} ${a.nro}`.localeCompare(`${b.fecha} ${b.hora} ${b.nro}`));
}
