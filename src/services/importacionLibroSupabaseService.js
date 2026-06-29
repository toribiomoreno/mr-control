import { assertSupabaseConfig, supabase } from '../lib/supabase.js';

const ORIGEN_LIBRO = 'libro-novedades-ferrovias';

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
    } else if (char === ';' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function normalizeDate(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return raw;
  const [, day, month, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function normalizeTime(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function stripLocomotivePrefix(detail, unidad) {
  const prefix = `LOCOMOTORA:${unidad}:`;
  return detail.startsWith(prefix) ? detail.slice(prefix.length).trim() : detail.trim();
}

function uniqueLines(lines) {
  return [...new Set(lines.map((line) => String(line || '').trim()).filter(Boolean))];
}

function parseLibroCsv(csvText, activeCodes) {
  const rows = String(csvText || '').split(/\r?\n/).map(parseCsvLine);
  const groups = new Map();
  let current = { nro: '', estado: '', fecha: '', hora: '', tipoUnidad: '', unidad: '' };

  for (const cells of rows) {
    const [nro, estado, fecha, hora, tipoUnidad, unidad, detalle] = cells;

    if (nro) {
      current = {
        nro,
        estado: estado || '',
        fecha: fecha || '',
        hora: hora || '',
        tipoUnidad: tipoUnidad || '',
        unidad: unidad || '',
      };
    } else {
      current = {
        ...current,
        estado: estado || current.estado,
        fecha: fecha || current.fecha,
        hora: hora || current.hora,
        tipoUnidad: tipoUnidad || current.tipoUnidad,
        unidad: unidad || current.unidad,
      };
    }

    const cleanDetail = String(detalle || '').trim();
    if (!/^\d+$/.test(current.nro)) continue;
    if (current.tipoUnidad !== 'LOCOMOTORA') continue;
    if (!activeCodes.has(current.unidad)) continue;
    if (!cleanDetail) continue;

    const normalizedDate = normalizeDate(current.fecha);
    const normalizedTime = normalizeTime(current.hora);
    const key = `${current.nro}|${normalizedDate}|${normalizedTime}|${current.unidad}`;
    const item = groups.get(key) || {
      nro: current.nro,
      estado: current.estado,
      fecha: normalizedDate,
      hora: normalizedTime,
      unidad: current.unidad,
      detalles: [],
    };

    item.detalles.push(stripLocomotivePrefix(cleanDetail, current.unidad));
    groups.set(key, item);
  }

  return [...groups.values()].map((item) => ({
    ...item,
    detalles: uniqueLines(item.detalles),
  }));
}

async function upsertLibroEvent(item, archivoOrigen, importacionId) {
  const clave = `libro-novedades|${item.nro}|${item.fecha}|${item.hora}|${item.unidad}`;
  const { data: existing, error: existingError } = await supabase
    .from('eventos_historial')
    .select('*')
    .eq('clave_importacion', clave)
    .maybeSingle();

  if (existingError) throw existingError;

  if (!existing) {
    const { error } = await supabase.from('eventos_historial').insert({
      locomotora_codigo: item.unidad,
      fecha: item.fecha,
      hora: item.hora,
      tipo: 'libro',
      titulo: 'Libro de novedades',
      descripcion: item.detalles.join('\n'),
      detalles: item.detalles,
      origen: ORIGEN_LIBRO,
      responsable: 'Sistema Ferrovias',
      automatico: true,
      nro_libro: item.nro,
      estado_libro: item.estado,
      archivo_origen: archivoOrigen,
      clave_importacion: clave,
      importacion_id: importacionId,
      criticidad: 'media',
    });

    if (error) throw error;
    return { created: 1, updated: 0 };
  }

  const merged = uniqueLines([...(existing.detalles || []), ...item.detalles]);
  if (merged.length === (existing.detalles || []).length) {
    return { created: 0, updated: 0 };
  }

  const { error } = await supabase
    .from('eventos_historial')
    .update({ descripcion: merged.join('\n'), detalles: merged })
    .eq('id', existing.id);

  if (error) throw error;
  return { created: 0, updated: 1 };
}

export async function importarLibroNovedades({ csvText, archivoOrigen, locomotoras }) {
  assertSupabaseConfig();
  const activeCodes = new Set(locomotoras.map((loco) => loco.codigo));
  const groups = parseLibroCsv(csvText, activeCodes);

  const { data: importacion, error: importError } = await supabase
    .from('importaciones_libro')
    .insert({
      archivo_origen: archivoOrigen,
      estado: 'procesando',
      total_grupos: groups.length,
    })
    .select('*')
    .single();

  if (importError) throw importError;

  let created = 0;
  let updated = 0;

  try {
    for (const item of groups) {
      const result = await upsertLibroEvent(item, archivoOrigen, importacion.id);
      created += result.created;
      updated += result.updated;
    }

    await supabase
      .from('importaciones_libro')
      .update({ estado: 'finalizado', eventos_creados: created, eventos_actualizados: updated })
      .eq('id', importacion.id);

    return { importacionId: importacion.id, grupos: groups.length, created, updated };
  } catch (error) {
    await supabase
      .from('importaciones_libro')
      .update({ estado: 'error', error_mensaje: error.message })
      .eq('id', importacion.id);
    throw error;
  }
}
