import { assertSupabaseConfig, supabase } from '../lib/supabase.js';
import {
  deleteEventAttachmentFiles,
  mapAttachmentRows,
  uploadEventAttachments,
} from './adjuntosSupabaseService.js';
import {
  calcularEstadoMantenimientoEvento,
  obtenerActualizaciones,
  sincronizarEstadoMantenimientoEvento,
} from './actualizacionesEventoSupabaseService.js';

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function mapEventRow(row) {
  return {
    id: row.id,
    locomotoraCodigo: row.locomotora_codigo,
    fecha: row.fecha,
    hora: row.hora,
    tipo: row.tipo,
    subtipo: row.subtipo,
    preventivoCodigo: row.preventivo_codigo,
    especialidad: row.especialidad,
    titulo: row.titulo,
    descripcion: row.descripcion,
    responsable: row.responsable,
    origen: row.origen,
    automatico: Boolean(row.automatico),
    tags: toArray(row.tags),
    detalles: toArray(row.detalles),
    metadata: row.metadata || {},
    criticidad: row.criticidad || 'baja',
    nroLibro: row.nro_libro,
    estadoLibro: row.estado_libro,
    claveImportacion: row.clave_importacion,
    archivoOrigen: row.archivo_origen,
    importacionId: row.importacion_id,
    estadoMantenimiento: row.estado_mantenimiento || (['preventivo', 'correctivo'].includes(row.tipo) ? 'abierto' : null),
    estadoUnidadResultante: row.estado_unidad_resultante,
    fechaCierre: row.fecha_cierre,
    horaCierre: row.hora_cierre ? String(row.hora_cierre).slice(0, 5) : '',
    ultimaActividadAt: row.ultima_actividad_at,
    anulado: Boolean(row.anulado),
    motivoAnulacion: row.motivo_anulacion,
    createdAt: row.created_at,
    adjuntos: [],
    actualizaciones: [],
  };
}

function toEventPayload(event) {
  return {
    locomotora_codigo: event.locomotoraCodigo,
    fecha: event.fecha,
    hora: event.hora,
    tipo: event.tipo,
    subtipo: event.subtipo || null,
    preventivo_codigo: event.preventivoCodigo || event.preventivo_codigo || null,
    titulo: event.titulo,
    descripcion: event.descripcion,
    especialidad: event.especialidad || null,
    responsable: event.responsable || null,
    criticidad: event.criticidad || 'baja',
    origen: event.origen || 'manual',
    automatico: Boolean(event.automatico),
    tags: toArray(event.tags),
    detalles: toArray(event.detalles),
    metadata: event.metadata || {},
    nro_libro: event.nroLibro || event.nro_libro || null,
    estado_libro: event.estadoLibro || event.estado_libro || null,
    clave_importacion: event.claveImportacion || event.clave_importacion || null,
    archivo_origen: event.archivoOrigen || event.archivo_origen || null,
    importacion_id: event.importacionId || event.importacion_id || null,
    estado_mantenimiento: event.estadoMantenimiento || event.estado_mantenimiento || null,
    estado_unidad_resultante: event.estadoUnidadResultante || event.estado_unidad_resultante || null,
    fecha_cierre: event.fechaCierre || event.fecha_cierre || null,
    hora_cierre: event.horaCierre || event.hora_cierre || null,
    anulado: Boolean(event.anulado),
    motivo_anulacion: event.motivoAnulacion || event.motivo_anulacion || null,
  };
}

async function attachFilesToEvents(rows, { canSyncMantenimiento = true } = {}) {
  const events = [];

  for (const row of rows || []) {
    const event = mapEventRow(row);
    event.adjuntos = await mapAttachmentRows(row.adjuntos_evento || []);
    if (['preventivo', 'correctivo'].includes(event.tipo)) {
      event.actualizaciones = await obtenerActualizaciones(event.id);
      Object.assign(
        event,
        canSyncMantenimiento
          ? await sincronizarEstadoMantenimientoEvento(event, event.actualizaciones)
          : calcularEstadoMantenimientoEvento(event, event.actualizaciones),
      );
    }
    events.push(event);
  }

  return events;
}

export async function fetchHistorialByLocomotora(locomotoraCodigo, options = {}) {
  assertSupabaseConfig();
  const { data, error } = await supabase
    .from('eventos_historial')
    .select('*, adjuntos_evento(*)')
    .eq('locomotora_codigo', locomotoraCodigo)
    .eq('anulado', false)
    .order('fecha', { ascending: false })
    .order('hora', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return attachFilesToEvents(data, options);
}

export async function createHistorialEvent(event, files, locomotoras) {
  assertSupabaseConfig();
  if (!locomotoras.some((loco) => loco.codigo === event.locomotoraCodigo)) {
    throw new Error(`La locomotora ${event.locomotoraCodigo} no existe.`);
  }

  const { data, error } = await supabase
    .from('eventos_historial')
    .insert(toEventPayload(event))
    .select('*, adjuntos_evento(*)')
    .single();

  if (error) throw error;

  const attachments = await uploadEventAttachments({
    eventId: data.id,
    locomotoraCodigo: data.locomotora_codigo,
    files,
  });

  return {
    ...mapEventRow(data),
    adjuntos: await mapAttachmentRows(attachments),
  };
}

export async function updateHistorialEvent(event, locomotoras) {
  assertSupabaseConfig();
  if (!event.id) throw new Error('El evento no tiene id de Supabase.');
  if (!locomotoras.some((loco) => loco.codigo === event.locomotoraCodigo)) {
    throw new Error(`La locomotora ${event.locomotoraCodigo} no existe.`);
  }

  const { data, error } = await supabase
    .from('eventos_historial')
    .update(toEventPayload(event))
    .eq('id', event.id)
    .select('*, adjuntos_evento(*)')
    .single();

  if (error) throw error;
  const [mapped] = await attachFilesToEvents([data]);
  return mapped;
}

export async function deleteHistorialEvent(eventId) {
  assertSupabaseConfig();
  await deleteEventAttachmentFiles(eventId);

  const { error } = await supabase
    .from('eventos_historial')
    .delete()
    .eq('id', eventId);

  if (error) throw error;
}
