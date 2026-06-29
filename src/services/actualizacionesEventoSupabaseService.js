import { assertSupabaseConfig, supabase } from '../lib/supabase.js';
import { attachmentKind, mapAttachmentRows } from './adjuntosSupabaseService.js';

const BUCKET = 'eventos-adjuntos';

function sanitizeFileName(name) {
  return String(name || 'archivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'archivo';
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeTime(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

function normalizeMaintenanceState(value) {
  if (!value || value === 'abierto') return 'en_curso';
  return value;
}

function updateSortValue(update) {
  return [
    update.fecha || '',
    normalizeTime(update.hora),
    update.createdAt || update.created_at || '',
  ].join(' ');
}

function activityTimestamp(fecha, hora) {
  if (!fecha || !hora) return null;
  return `${fecha} ${normalizeTime(hora)}:00`;
}

function mapActualizacionRow(row, adjuntos = []) {
  return {
    id: row.id,
    eventoId: row.evento_id,
    fecha: row.fecha,
    hora: normalizeTime(row.hora),
    tipoActualizacion: row.tipo_actualizacion,
    descripcion: row.descripcion,
    responsable: row.responsable,
    porcentajeAvance: row.porcentaje_avance,
    estadoResultante: row.estado_resultante,
    motivoPausa: row.motivo_pausa,
    motivoReapertura: row.motivo_reapertura,
    resultadoPrueba: row.resultado_prueba,
    estadoUnidadResultante: row.estado_unidad_resultante,
    pendientes: row.pendientes,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    adjuntos,
  };
}

function toActualizacionPayload(actualizacion) {
  return {
    evento_id: actualizacion.eventoId || actualizacion.evento_id,
    fecha: actualizacion.fecha,
    hora: actualizacion.hora || null,
    tipo_actualizacion: actualizacion.tipoActualizacion || actualizacion.tipo_actualizacion || 'avance',
    descripcion: actualizacion.descripcion,
    responsable: actualizacion.responsable || null,
    porcentaje_avance: actualizacion.porcentajeAvance === '' || actualizacion.porcentajeAvance == null
      ? null
      : Number(actualizacion.porcentajeAvance),
    estado_resultante: actualizacion.estadoResultante || actualizacion.estado_resultante || null,
    motivo_pausa: actualizacion.motivoPausa || actualizacion.motivo_pausa || null,
    motivo_reapertura: actualizacion.motivoReapertura || actualizacion.motivo_reapertura || null,
    resultado_prueba: actualizacion.resultadoPrueba || actualizacion.resultado_prueba || null,
    estado_unidad_resultante: actualizacion.estadoUnidadResultante || actualizacion.estado_unidad_resultante || null,
    pendientes: actualizacion.pendientes || null,
    metadata: actualizacion.metadata || {},
  };
}

async function conservarCierreSiEsObservacionFinalizada(actualizacion, event) {
  const estadoEvento = event.estadoMantenimiento || event.estado_mantenimiento;
  const esObservacion = (actualizacion.tipoActualizacion || actualizacion.tipo_actualizacion) === 'observacion';
  if (!esObservacion || estadoEvento !== 'finalizado') return;

  const { error } = await supabase
    .from('eventos_historial')
    .update({
      estado_mantenimiento: 'finalizado',
      fecha_cierre: event.fechaCierre || event.fecha_cierre || event.fecha || null,
      hora_cierre: event.horaCierre || event.hora_cierre || event.hora || null,
    })
    .eq('id', event.id || event.eventoId || event.evento_id);

  if (error) throw error;
}

function resolverEstadoMantenimiento(event, actualizaciones = []) {
  const ordered = [...actualizaciones].sort((a, b) => updateSortValue(a).localeCompare(updateSortValue(b)));
  const currentState = normalizeMaintenanceState(event.estadoMantenimiento || event.estado_mantenimiento);
  let estado = currentState;
  let fechaCierre = event.fechaCierre || event.fecha_cierre || null;
  let horaCierre = event.horaCierre || event.hora_cierre || null;
  let ultimaActividadAt = event.ultimaActividadAt || event.ultima_actividad_at || null;
  let hasStateChange = false;

  for (const update of ordered) {
    const type = update.tipoActualizacion || update.tipo_actualizacion;

    if (type === 'cierre') {
      estado = 'finalizado';
      fechaCierre = update.fecha;
      horaCierre = normalizeTime(update.hora);
      ultimaActividadAt = activityTimestamp(update.fecha, update.hora);
      hasStateChange = true;
      continue;
    }

    if (type === 'reapertura') {
      estado = 'en_curso';
      fechaCierre = null;
      horaCierre = null;
      ultimaActividadAt = activityTimestamp(update.fecha, update.hora);
      hasStateChange = true;
      continue;
    }

    if (estado === 'finalizado') continue;

    if (type === 'pausa') {
      estado = 'pausado';
      ultimaActividadAt = activityTimestamp(update.fecha, update.hora);
      hasStateChange = true;
    }

    if (type === 'reanudacion') {
      estado = 'en_curso';
      ultimaActividadAt = activityTimestamp(update.fecha, update.hora);
      hasStateChange = true;
    }
  }

  return {
    estado,
    fechaCierre,
    hasStateChange,
    horaCierre: normalizeTime(horaCierre),
    ultimaActividadAt,
  };
}

export async function sincronizarEstadoMantenimientoEvento(event, actualizaciones = []) {
  assertSupabaseConfig();
  if (!['preventivo', 'correctivo'].includes(event.tipo)) return event;

  const resolved = resolverEstadoMantenimiento(event, actualizaciones);
  const currentState = normalizeMaintenanceState(event.estadoMantenimiento || event.estado_mantenimiento);
  const shouldPreserveFinalized = currentState === 'finalizado';

  if (!resolved.hasStateChange && !shouldPreserveFinalized) {
    return {
      ...event,
      estadoMantenimiento: currentState,
    };
  }

  const desired = {
    estado_mantenimiento: resolved.estado,
    fecha_cierre: resolved.estado === 'finalizado' ? resolved.fechaCierre : null,
    hora_cierre: resolved.estado === 'finalizado' ? resolved.horaCierre : null,
    ultima_actividad_at: resolved.ultimaActividadAt,
  };

  const differs = currentState !== desired.estado_mantenimiento
    || (event.fechaCierre || event.fecha_cierre || null) !== desired.fecha_cierre
    || normalizeTime(event.horaCierre || event.hora_cierre) !== normalizeTime(desired.hora_cierre);

  if (differs) {
    const { error } = await supabase
      .from('eventos_historial')
      .update(desired)
      .eq('id', event.id || event.eventoId || event.evento_id);

    if (error) throw error;
  }

  return {
    ...event,
    estadoMantenimiento: desired.estado_mantenimiento,
    fechaCierre: desired.fecha_cierre,
    horaCierre: normalizeTime(desired.hora_cierre),
    ultimaActividadAt: desired.ultima_actividad_at,
  };
}

async function deleteActualizacionAttachmentFiles(actualizacionId) {
  const { data, error } = await supabase
    .from('adjuntos_evento')
    .select('storage_path')
    .eq('actualizacion_id', actualizacionId);

  if (error) throw error;

  const paths = (data || []).map((item) => item.storage_path).filter(Boolean);
  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
    if (removeError) throw removeError;
  }
}

export async function obtenerUrlFirmadaAdjunto(storagePath) {
  assertSupabaseConfig();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function obtenerActualizaciones(eventoId) {
  assertSupabaseConfig();
  const { data, error } = await supabase
    .from('actualizaciones_evento')
    .select('*')
    .eq('evento_id', eventoId)
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true });

  if (error) throw error;

  const ids = (data || []).map((row) => row.id);
  if (ids.length === 0) return [];

  const { data: attachmentRows, error: attachmentError } = await supabase
    .from('adjuntos_evento')
    .select('*')
    .in('actualizacion_id', ids)
    .order('orden', { ascending: true });

  if (attachmentError) throw attachmentError;

  const attachmentsByUpdate = new Map();
  for (const row of attachmentRows || []) {
    const list = attachmentsByUpdate.get(row.actualizacion_id) || [];
    list.push(row);
    attachmentsByUpdate.set(row.actualizacion_id, list);
  }

  const mapped = [];
  for (const row of data || []) {
    mapped.push(mapActualizacionRow(row, await mapAttachmentRows(attachmentsByUpdate.get(row.id) || [])));
  }

  return mapped;
}

export async function subirAdjuntosActualizacion({ eventoId, actualizacionId, locomotoraCodigo, files }) {
  assertSupabaseConfig();
  const uploadFiles = Array.from(files || []).filter((file) => file?.name);
  if (uploadFiles.length === 0) return [];

  const rows = [];

  for (const [index, file] of uploadFiles.entries()) {
    const safeName = sanitizeFileName(file.name);
    const storagePath = `${locomotoraCodigo || 'mantenimiento'}/${eventoId}/actualizaciones/${actualizacionId}/${randomId()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

    if (uploadError) throw uploadError;

    rows.push({
      evento_id: eventoId,
      actualizacion_id: actualizacionId,
      tipo: attachmentKind(file),
      nombre_archivo: file.name,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size || 0,
      orden: index,
    });
  }

  const { data, error } = await supabase
    .from('adjuntos_evento')
    .insert(rows)
    .select('*');

  if (error) throw error;
  return mapAttachmentRows(data || []);
}

export async function crearActualizacion(actualizacion, files = [], event = {}) {
  assertSupabaseConfig();
  const { data, error } = await supabase
    .from('actualizaciones_evento')
    .insert(toActualizacionPayload(actualizacion))
    .select('*')
    .single();

  if (error) throw error;

  const adjuntos = await subirAdjuntosActualizacion({
    eventoId: data.evento_id,
    actualizacionId: data.id,
    locomotoraCodigo: event.locomotoraCodigo || event.locomotora_codigo,
    files,
  });

  const actualizaciones = await obtenerActualizaciones(data.evento_id);
  await sincronizarEstadoMantenimientoEvento(event, actualizaciones);
  await conservarCierreSiEsObservacionFinalizada(actualizacion, event);

  return mapActualizacionRow(data, adjuntos);
}

export async function editarActualizacion(actualizacion, files = [], event = {}) {
  assertSupabaseConfig();
  if (!actualizacion.id) throw new Error('La actualizacion no tiene id de Supabase.');

  const { data, error } = await supabase
    .from('actualizaciones_evento')
    .update(toActualizacionPayload(actualizacion))
    .eq('id', actualizacion.id)
    .select('*')
    .single();

  if (error) throw error;

  await subirAdjuntosActualizacion({
    eventoId: data.evento_id,
    actualizacionId: data.id,
    locomotoraCodigo: event.locomotoraCodigo || event.locomotora_codigo,
    files,
  });

  const [updated] = await obtenerActualizaciones(data.evento_id).then((items) => items.filter((item) => item.id === data.id));
  return updated || mapActualizacionRow(data);
}

export async function eliminarActualizacion(actualizacionId) {
  assertSupabaseConfig();
  await deleteActualizacionAttachmentFiles(actualizacionId);

  const { error } = await supabase
    .from('actualizaciones_evento')
    .delete()
    .eq('id', actualizacionId);

  if (error) throw error;
}
