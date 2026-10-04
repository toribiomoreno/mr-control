import { dailyStateRecord, maintenanceAt } from './dailyState.js';
import { validateEvent } from './adapter.js';
import { wholeLocomotive } from './types.js';

// Un ingreso informado no es un avance de trabajo: no agrega jornadas ni personal interviniente.
export function maintenanceIntake(row, date, time, events, id) {
  if (row.newState !== 'detenida' || !row.reason?.trim() || maintenanceAt(events, row.unit, date, time).length) return null;
  const preventive = row.classification === 'preventivo';
  // No asignar un numeral o un examen distinto del informado.
  if (preventive && !/^(E|A|AB|ABC|Numeral ([1-9]|1[0-2]))$/.test(row.preventiveCode || '')) return null;
  const light = preventive && ['E', 'A', 'AB', 'ABC'].includes(row.preventiveCode);
  const event = {
    id, locomotoraCodigo: row.unit, fecha: date, hora: time,
    tipo: preventive ? 'preventivo' : 'correctivo', preventivoCodigo: preventive ? row.preventiveCode : null,
    titulo: preventive ? `Ingreso a preventivo ${row.preventiveCode}` : `Ingreso a correctivo · ${row.reason.trim()}`,
    descripcion: row.reason.trim(), responsable: light ? wholeLocomotive.staff : 'Parte diario',
    estadoMantenimiento: 'en_curso', estadoUnidadResultante: 'fuera_de_servicio',
    metadata: { seguimiento: {
      captureVersion: 3, detentionStart: date, confirmedThrough: date, detentionReason: row.reason.trim(),
      location: 'Boulogne', system: preventive ? wholeLocomotive.system : 'Otro',
      component: preventive ? wholeLocomotive.component : row.reason.trim(), outcome: 'continua',
      intake: { source: 'parte-diario', pendingSystem: !preventive, pendingStart: true, pendingLocation: true,
        note: 'Fecha y hora del primer parte de detención. No confirman el inicio exacto, trabajo ni personal interviniente.' },
    } }, actualizaciones: [],
  };
  validateEvent(event, date);
  return event;
}

export function dailyImportBatch(preview, events, newId = () => crypto.randomUUID()) {
  const fresh = [], intakes = [];
  // Validar todos los conflictos antes de escribir cualquier fila.
  for (const row of preview.rows) {
    const existing = events.find(event => event.locomotoraCodigo === row.unit && event.fecha === preview.date
      && event.hora?.slice(0, 5) === preview.time && event.metadata?.dailyState);
    if (existing) {
      if (existing.metadata.dailyState.reportedState !== row.newState || existing.metadata.dailyState.observation !== (row.reason || '')) {
        throw new Error(`Ya existe un parte distinto para ${row.unit} en esa fecha y hora. Revisalo antes de corregirlo.`);
      }
      continue;
    }
    const intake = maintenanceIntake(row, preview.date, preview.time, events, newId());
    if (intake) {
      intakes.push(intake);
      fresh.push({ id: intake.id, locomotora_codigo: intake.locomotoraCodigo, fecha: intake.fecha, hora: intake.hora,
        tipo: intake.tipo, preventivo_codigo: intake.preventivoCodigo, titulo: intake.titulo, descripcion: intake.descripcion,
        responsable: intake.responsable, origen: 'parte-diario', automatico: true, criticidad: 'baja',
        estado_mantenimiento: intake.estadoMantenimiento, estado_unidad_resultante: intake.estadoUnidadResultante,
        clave_importacion: `ingreso-parte|${preview.date}|${preview.time}|${row.unit}`, metadata: intake.metadata });
    }
    fresh.push({ id: newId(), locomotora_codigo: row.unit, fecha: preview.date, hora: preview.time, tipo: 'otro',
      preventivo_codigo: null, estado_mantenimiento: null, estado_unidad_resultante: null,
      titulo: 'Estado diario de la máquina', descripcion: row.reason || '', origen: 'parte-diario',
      responsable: 'Parte diario', automatico: true, criticidad: 'baja',
      clave_importacion: `estado-diario|${preview.date}|${preview.time}|${row.unit}`,
      metadata: { dailyState: { ...dailyStateRecord({ ...row, reportDate: preview.date, reportTime: preview.time }, [...events, ...intakes]), rawLine: row.raw, source: 'parte-diario' } } });
  }
  return { rows: fresh, intakes, created: fresh.length - intakes.length, unchanged: preview.rows.length - fresh.length + intakes.length };
}
