import { assertSupabaseConfig, supabase } from '../lib/supabase.js';

import { parseLibroCsv, uniqueBookLines } from '../domain/maintenance/bookImport.js';

const ORIGEN_LIBRO = 'libro-novedades-ferrovias';

function normalizeArchivoOrigen(archivoOrigen) {
  if (typeof archivoOrigen === 'string' && archivoOrigen.trim()) {
    return archivoOrigen.trim();
  }

  return archivoOrigen?.name?.trim() || 'libro_novedades.csv';
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
      titulo: 'Novedad · libro de turno',
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

  const merged = uniqueBookLines([...(existing.detalles || []), ...item.detalles]);
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
  if (!groups.length) throw new Error('No hay novedades de locomotoras reconocidas para importar.');
  const nombreArchivo = normalizeArchivoOrigen(archivoOrigen);

  const { data: importacion, error: importError } = await supabase
    .from('importaciones_libro')
    .insert({
      nombre_archivo: nombreArchivo,
      archivo_origen: nombreArchivo,
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
      const result = await upsertLibroEvent(item, nombreArchivo, importacion.id);
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
