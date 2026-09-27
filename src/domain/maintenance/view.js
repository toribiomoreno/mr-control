import { today, shiftDay } from './types.js';

export const outcomeLabels = {
  continua: 'Continúa el mantenimiento', disponible: 'Disponible', operativa: 'Operativa',
  prueba: 'Pendiente de prueba', detenida: 'Detenida por otro motivo', pendiente: 'Por confirmar',
};
export const isVisibleMaintenance = event => ['preventivo', 'correctivo'].includes(event.tipo) && !event.anulado && event.estadoMantenimiento !== 'cancelado';
export const maintenanceLabel = event => event.tipo === 'preventivo' ? `Preventivo ${event.preventivoCodigo || 'sin tipo'}` : (event.metadata?.seguimiento?.detentionReason || event.descripcion || event.titulo || 'Correctivo').split('\n')[0];
export const detentionReason = event => event.metadata?.seguimiento?.detentionReason || (event.tipo === 'preventivo' ? 'Kilometraje' : event.descripcion?.split('\n')[0]) || 'Por confirmar';
export function orderedUpdates(event) {
  return [...(event.actualizaciones || [])].sort((a, b) => `${a.fecha} ${a.hora || ''} ${a.createdAt || ''}`.localeCompare(`${b.fecha} ${b.hora || ''} ${b.createdAt || ''}`));
}
export function outcomeAtEnd(event) {
  const latest = orderedUpdates(event).filter(a => a.metadata?.seguimiento?.outcome || ['cierre', 'reapertura'].includes(a.tipoActualizacion)).at(-1);
  let code = latest ? latest.metadata?.seguimiento?.outcome || (latest.estadoUnidadResultante === 'servicio' ? 'operativa' : latest.estadoUnidadResultante === 'pendiente_de_prueba' ? 'prueba' : latest.tipoActualizacion === 'reapertura' ? 'continua' : 'pendiente') : event.metadata?.seguimiento?.outcome;
  if (event.estadoMantenimiento === 'finalizado' && code === 'continua') code = 'pendiente';
  if (event.estadoMantenimiento !== 'finalizado' && ['disponible', 'operativa'].includes(code)) code = 'pendiente';
  if (code) return { code, label: outcomeLabels[code] || 'Por confirmar', date: latest?.fecha || event.fechaCierre || event.fecha };
  if (event.estadoUnidadResultante === 'servicio') return { code: 'operativa', label: 'Operativa', date: event.fechaCierre };
  if (event.estadoUnidadResultante === 'pendiente_de_prueba') return { code: 'prueba', label: 'Pendiente de prueba', date: event.fechaCierre };
  if (event.metadata?.seguimiento?.availableDate) return { code: 'disponible', label: 'Disponible', date: event.metadata.seguimiento.availableDate };
  return { code: 'pendiente', label: event.estadoMantenimiento === 'finalizado' ? 'Finalizado · disponibilidad por confirmar' : 'Abierto · continuidad por confirmar', date: '' };
}
export function updateOutcomeLabel(event, update) {
  const explicit = update.metadata?.seguimiento?.outcome;
  if (explicit) return outcomeLabels[explicit] || 'Estado por confirmar';
  const final = outcomeAtEnd(event);
  return final.date === update.fecha ? final.label : 'Estado por confirmar';
}
export function maintenanceWindow(event, now = today()) {
  const meta = event.metadata?.seguimiento || {};
  const start = meta.detentionStart || event.fecha;
  const end = event.estadoMantenimiento === 'finalizado' ? event.fechaCierre || event.fecha : now;
  const confirmedThrough = [meta.confirmedThrough || '', start, ...(event.actualizaciones || []).filter(a => ['trabajo', 'mixto', 'espera'].includes(a.metadata?.seguimiento?.activity) || a.metadata?.seguimiento?.outcome === 'continua').map(a => a.fecha)].filter(Boolean).sort().at(-1);
  return { start, end, confirmedThrough, unconfirmed: event.estadoMantenimiento !== 'finalizado' && confirmedThrough < now };
}
export function maintenanceBars(events, from, to, now = today()) {
  const dayIndex = day => Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
  const laneEnds = [];
  return events.filter(isVisibleMaintenance).map(event => ({ event, ...maintenanceWindow(event, now) }))
    .filter(item => item.start <= to && item.end >= from)
    .sort((a,b) => a.start.localeCompare(b.start) || String(a.event.id).localeCompare(String(b.event.id)))
    .map(item => {
      const start = item.start < from ? from : item.start, end = item.end > to ? to : item.end;
      let lane = laneEnds.findIndex(last => last < start);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = end;
      return { ...item, start, end, id: item.event.id, kind: item.event.tipo, label: maintenanceLabel(item.event), reason: detentionReason(item.event), column: dayIndex(start) + 1, span: dayIndex(end) - dayIndex(start) + 1, lane };
    });
}
export function isoWeek(day) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const year = date.getUTCFullYear();
  return { year, number: Math.ceil((((date - new Date(Date.UTC(year, 0, 1, 12))) / 86400000) + 1) / 7) };
}
export function dailyMaintenance(events, day, now = today()) {
  return maintenanceBars(events, day, day, now).map(bar => ({ ...bar, updates: orderedUpdates(bar.event).filter(a => a.fecha === day) }));
}
export function evidenceQuestions(event) {
  const questions = [];
  const meta = event.metadata?.seguimiento || {};
  const missing = value => !value || /por confirmar/i.test(value);
  if (!meta.detentionStart) questions.push({ field: 'meta', text: '¿Desde cuándo quedó detenida?' });
  if (detentionReason(event) === 'Por confirmar') questions.push({ field: 'meta', text: '¿Por qué quedó detenida?' });
  if (event.tipo === 'correctivo' && (missing(meta.system) || missing(meta.component))) questions.push({ field: 'meta', text: '¿Qué sistema y parte se intervinieron?' });
  if (!(event.actualizaciones || []).length) questions.push({ field: 'activity', text: '¿Se intervino? Indicá fecha, turno y personal, o el motivo por el que no se trabajó.' });
  for (const update of orderedUpdates(event)) {
    const t = update.metadata?.seguimiento || {};
    const add = text => questions.push({ update, text: `${update.fecha}: ${text}` });
    if (!t.activity || t.activity === 'sin_dato') add('¿Se trabajó ese día?');
    if (['trabajo', 'mixto'].includes(t.activity) && missing(update.responsable)) add('¿Quién intervino?');
    if (['trabajo', 'mixto'].includes(t.activity) && event.tipo === 'correctivo' && (missing(t.system || meta.system) || missing(t.component || meta.component))) add('¿Qué parte se trabajó?');
    if (['espera', 'mixto'].includes(t.activity) && (!t.cause || t.cause === 'PENDIENTE')) add('¿Por qué no se pudo trabajar?');
  }
  if (outcomeAtEnd(event).code === 'pendiente') questions.push({ field: 'outcome', text: '¿Quedó disponible, operativa o continúa el mantenimiento?' });
  return questions;
}

export function operatingSegments(events, from, to) {
  const active = events.filter(isVisibleMaintenance);
  const result = [];
  for (const event of active) {
    const outcome = outcomeAtEnd(event);
    if (event.estadoMantenimiento !== 'finalizado' || !['operativa', 'disponible'].includes(outcome.code) || !outcome.date) continue;
    const start = shiftDay(outcome.date, 1);
    const stops = active.filter(other => other.id !== event.id).map(other => maintenanceWindow(other, to));
    if (stops.some(stop => stop.start < start && stop.end >= start)) continue;
    const nextStop = stops.filter(stop => stop.start >= start).map(stop => stop.start).sort()[0];
    const end = nextStop ? shiftDay(nextStop, -1) : to;
    if (start > to || end < from || end < start) continue;
    result.push({ id: `${event.id}-available`, start: start < from ? from : start, end: end > to ? to : end, kind: outcome.code, label: outcome.label, reason: `${outcome.label} desde ${outcome.date} · último estado informado` });
  }
  return result;
}
