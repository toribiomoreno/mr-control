import { assertSupabaseConfig, supabase } from '../lib/supabase.js';
import { dailyStateRecord } from '../domain/maintenance/dailyState.js';
import { fleet, today } from '../domain/maintenance/types.js';
import { validDate, validateUpdate, isMaintenance } from '../domain/maintenance/adapter.js';
import { pendingFollowUps } from '../domain/maintenance/followUp.js';
import { fetchSeguimiento } from './seguimientoService.js';
import { fetchFleetConfirmations } from './fleetConfirmationService.js';

const fail = message => { throw new Error(message); };
const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
async function evidence() {
  const [jobs, states] = await Promise.all([fetchSeguimiento(), fetchFleetConfirmations()]);
  return [...jobs, ...states];
}

export async function guardarEstadoDiario(preview) {
  assertSupabaseConfig();
  if (!preview.canConfirm || !validDate(preview.date) || preview.date > today() || !validTime(preview.time)
    || preview.rows.length !== fleet.length || new Set(preview.rows.map(row => row.unit)).size !== fleet.length
    || preview.rows.some(row => !fleet.includes(row.unit) || !['operativa','detenida','reserva','uso_excepcional'].includes(row.newState))) {
    fail('Revisá las 27 unidades, la fecha y la hora del parte antes de guardar.');
  }
  const events = await evidence();
  const fresh = [];
  for (const row of preview.rows) {
    const existing = events.find(event => event.locomotoraCodigo === row.unit && event.fecha === preview.date
      && event.hora?.slice(0, 5) === preview.time && event.metadata?.dailyState);
    if (existing) {
      if (existing.metadata.dailyState.reportedState !== row.newState || existing.metadata.dailyState.observation !== (row.reason || '')) {
        fail(`Ya existe un parte distinto para ${row.unit} en esa fecha y hora. Revisalo antes de corregirlo.`);
      }
      continue;
    }
    fresh.push({ locomotora_codigo: row.unit, fecha: preview.date, hora: preview.time, tipo: 'otro',
      titulo: 'Estado diario de la máquina', descripcion: row.reason || '', origen: 'parte-diario',
      responsable: 'Parte diario', automatico: true, criticidad: 'baja',
      clave_importacion: `estado-diario|${preview.date}|${preview.time}|${row.unit}`,
      metadata: { dailyState: { ...dailyStateRecord({ ...row, reportDate: preview.date, reportTime: preview.time }, events), rawLine: row.raw, source: 'parte-diario' } } });
  }
  if (fresh.length) {
    // Una única inserción por lote y la clave única existente evitan cargas parciales o repetidas.
    const { error } = await supabase.from('eventos_historial').insert(fresh);
    if (error) throw new Error(error.code === '23505' ? 'Este parte se guardó desde otra sesión. Actualizá y verificá los datos.' : error.message);
  }
  return { created: fresh.length, unchanged: fleet.length - fresh.length };
}

async function responseId(key) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`mr-followup:${key}`)));
  hash[6] = (hash[6] & 15) | 128; hash[8] = (hash[8] & 63) | 128;
  const hex = [...hash.slice(0, 16)].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export async function guardarResultadoSeguimiento(request, { result, fecha, hora, descripcion }) {
  assertSupabaseConfig();
  if (!['sin_novedades','pendiente','nueva_falla'].includes(result) || !validDate(fecha) || fecha > today()
    || !validTime(hora) || !descripcion?.trim()) fail('Confirmá el resultado, la fecha, la hora y la novedad.');
  const events = await evidence();
  const fresh = pendingFollowUps(events, today()).find(item => item.key === request.key);
  if (!fresh) fail('La consulta ya fue respondida o cambió su origen. Actualizá la vista.');
  const parent = fresh.event;
  const source = parent.actualizaciones?.find(update => `avance:${update.id}` === request.key) || parent;
  if (`${fecha} ${hora}` < `${fresh.date} ${source.hora?.slice(0,5) || '00:00'}`) fail('La respuesta no puede ser anterior a la novedad.');
  if (result === 'sin_novedades' && events.some(event => event.id !== parent.id && event.locomotoraCodigo === fresh.codigo
    && isMaintenance(event) && event.estadoMantenimiento !== 'cancelado' && event.estadoMantenimiento !== 'finalizado' && event.fecha <= fecha)) {
    fail('Hay otro mantenimiento abierto. Revisalo antes de confirmar disponibilidad.');
  }
  const id = await responseId(request.key);
  const resultMeta = { key: request.key, kind: fresh.kind, result, sourceId: source.id };
  const closed = parent.estadoMantenimiento === 'finalizado';
  let saved;
  if (isMaintenance(parent)) {
    const update = { id, fecha, hora, tipoActualizacion: !closed && result === 'sin_novedades' ? 'cierre' : 'observacion',
      descripcion: descripcion.trim(), estadoUnidadResultante: result === 'sin_novedades' ? 'servicio' : result === 'nueva_falla' ? 'fuera_de_servicio' : null,
      metadata: { followUpResult: resultMeta, seguimiento: { activity: 'sin_dato', captureVersion: 3,
        confirmedUnknownActivity: true, outcome: !closed && result === 'sin_novedades' ? 'operativa' : null } } };
    validateUpdate(parent, update);
    saved = await supabase.from('actualizaciones_evento').insert({ id, evento_id: parent.id, fecha, hora,
      tipo_actualizacion: update.tipoActualizacion, descripcion: update.descripcion,
      estado_unidad_resultante: update.estadoUnidadResultante, metadata: update.metadata });
  } else {
    saved = await supabase.from('eventos_historial').insert({ id, locomotora_codigo: fresh.codigo, fecha, hora,
      tipo: 'otro', titulo: 'Resultado de salida o prueba', descripcion: descripcion.trim(), origen: 'manual', criticidad: 'baja',
      clave_importacion: `seguimiento|${request.key}`, metadata: { followUpResult: resultMeta,
        fleetConfirmation: { state: result === 'sin_novedades' ? 'operativa' : result === 'nueva_falla' ? 'detenida' : parent.metadata?.dailyState?.state || parent.metadata?.fleetConfirmation?.state || 'operativa',
          source: 'seguimiento', needsMaintenance: result === 'nueva_falla' } } });
  }
  if (saved.error) throw new Error(saved.error.code === '23505' ? 'Esta consulta ya fue respondida. Actualizá la vista.' : saved.error.message);
  return { id, needsMaintenance: result === 'nueva_falla' && (closed || !isMaintenance(parent)) };
}
