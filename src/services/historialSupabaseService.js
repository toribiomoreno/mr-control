import { assertSupabaseConfig, supabase } from '../lib/supabase.js';
import {
  deleteEventAttachmentFiles,
  mapAttachmentRows,
  uploadEventAttachments,
} from './adjuntosSupabaseService.js';

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
    anulado: Boolean(row.anulado),
    motivoAnulacion: row.motivo_anulacion,
    createdAt: row.created_at,
    adjuntos: [],
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
    anulado: Boolean(event.anulado),
    motivo_anulacion: event.motivoAnulacion || event.motivo_anulacion || null,
  };
}

async function attachFilesToEvents(rows) {
  const events = [];

  for (const row of rows || []) {
    const event = mapEventRow(row);
    event.adjuntos = await mapAttachmentRows(row.adjuntos_evento || []);
    events.push(event);
  }

  return events;
}

export async function fetchHistorialByLocomotora(locomotoraCodigo) {
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
  return attachFilesToEvents(data);
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
