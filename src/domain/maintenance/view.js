import { today, shiftDay } from './types.js';

export const outcomeLabels = {
  continua: 'Continúa el mantenimiento', operativa: 'Operativa',
  acompanada: 'Operativa · sale acompañada', operativa_prueba: 'Operativa · prueba pendiente',
  prueba: 'Pendiente de prueba', detenida: 'Detenida por otro motivo', pendiente: 'Por confirmar',
};
export const operationalOutcomes = ['operativa', 'disponible', 'acompanada', 'operativa_prueba'];
export const workDurationLabel = tracking => tracking.workDurationShifts ? `${tracking.workDurationShifts} turno${tracking.workDurationShifts > 1 ? 's' : ''}` : tracking.workDurationDays === 1 ? 'Jornada completa' : tracking.workDurationDays === 0.5 ? 'Media jornada' : tracking.confirmedUnknownDuration ? 'Duración por confirmar' : '';
export const isVisibleMaintenance = event => ['preventivo', 'correctivo'].includes(event.tipo) && !event.anulado && event.estadoMantenimiento !== 'cancelado';
export const maintenanceLabel = event => event.tipo === 'preventivo' ? `Preventivo ${event.preventivoCodigo || 'sin tipo'}` : (event.metadata?.seguimiento?.detentionReason || event.descripcion || event.titulo || 'Correctivo').split('\n')[0];
export const detentionReason = event => event.metadata?.seguimiento?.detentionReason || (event.tipo === 'preventivo' ? 'Kilometraje' : event.descripcion?.split('\n')[0]) || 'Por confirmar';
export function orderedUpdates(event) {
  return [...(event.actualizaciones || [])].sort((a, b) => `${a.fecha} ${a.hora || ({ Mañana: '06:00', Tarde: '14:00', 'Mañana y tarde': '06:00' }[a.metadata?.seguimiento?.period] || '')} ${a.createdAt || ''}`.localeCompare(`${b.fecha} ${b.hora || ({ Mañana: '06:00', Tarde: '14:00', 'Mañana y tarde': '06:00' }[b.metadata?.seguimiento?.period] || '')} ${b.createdAt || ''}`));
}
// Un avance describe el estado de ese momento, aunque el mantenimiento haya cerrado después.
export function beforeMaintenanceClosure(event, update) {
  if (event.estadoMantenimiento !== 'finalizado' || update.tipoActualizacion === 'cierre') return false;
  if (update.fecha < event.fechaCierre) return true;
  if (update.fecha !== event.fechaCierre) return false;
  const closure = orderedUpdates(event).filter(a => a.tipoActualizacion === 'cierre').at(-1);
  if (update.hora && closure?.hora) return update.hora < closure.hora;
  const original = (event.actualizaciones || []).find(a => a.id === update.id);
  if (!original || original.fecha !== update.fecha) return false;
  if (original.metadata?.seguimiento?.outcome === 'continua') return true;
  return !!(closure?.createdAt && original.createdAt && original.createdAt < closure.createdAt);
}

export function trackingForCurrentState(event, tracking = event.metadata?.seguimiento || {}) {
  if (event.estadoMantenimiento !== 'finalizado') return tracking;
  const closure = orderedUpdates(event).filter(update => update.tipoActualizacion === 'cierre').at(-1);
  const saved = closure?.metadata?.seguimiento?.outcome || tracking.outcome;
  const outcome = saved === 'detenida' ? saved : operationalOutcomes.includes(saved) ? saved : 'operativa';
  return { ...tracking, outcome, availableDate: outcome === 'detenida' ? undefined : event.fechaCierre || tracking.availableDate || event.fecha };
}
export function outcomeAtEnd(event) {
  if (event.estadoMantenimiento === 'finalizado') {
    const latestResult = orderedUpdates(event).filter(update => update.metadata?.followUpResult).at(-1);
    const resolution = latestResult?.metadata.followUpResult.result;
    const closure = orderedUpdates(event).filter(update => update.tipoActualizacion === 'cierre').at(-1);
    const saved = closure?.metadata?.seguimiento?.outcome || event.metadata?.seguimiento?.outcome;
    const code = resolution === 'sin_novedades' ? 'operativa' : resolution === 'nueva_falla' ? 'detenida' : resolution === 'pendiente' ? latestResult.metadata.followUpResult.kind === 'acompanada' ? 'acompanada' : 'operativa_prueba' : saved === 'detenida' ? 'detenida' : operationalOutcomes.includes(saved) && saved !== 'disponible' ? saved : event.estadoUnidadResultante === 'pendiente_de_prueba' ? 'operativa_prueba' : 'operativa';
    return { code, label: outcomeLabels[code], date: latestResult?.fecha || event.fechaCierre || event.metadata?.seguimiento?.availableDate || event.fecha, time: latestResult?.hora || event.horaCierre || '' };
  }
  const latest = orderedUpdates(event).filter(a => a.metadata?.seguimiento?.outcome || ['cierre', 'reapertura'].includes(a.tipoActualizacion)).at(-1);
  let code = latest ? latest.metadata?.seguimiento?.outcome || (latest.estadoUnidadResultante === 'servicio' ? 'operativa' : latest.estadoUnidadResultante === 'pendiente_de_prueba' ? 'prueba' : latest.tipoActualizacion === 'reapertura' ? 'continua' : 'pendiente') : event.metadata?.seguimiento?.outcome;
  if (event.estadoMantenimiento !== 'finalizado' && operationalOutcomes.includes(code)) code = 'pendiente';
  if (code === 'disponible') code = 'operativa';
  if (code) return { code, label: outcomeLabels[code] || 'Por confirmar', date: latest?.fecha || event.fechaCierre || event.fecha };
  if (event.estadoUnidadResultante === 'servicio') return { code: 'operativa', label: 'Operativa', date: event.fechaCierre };
  if (event.estadoUnidadResultante === 'pendiente_de_prueba') return { code: 'prueba', label: 'Pendiente de prueba', date: event.fechaCierre };
  return { code: 'pendiente', label: 'Abierto · continuidad por confirmar', date: '' };
}
export function updateOutcomeLabel(event, update) {
  const result = update.metadata?.followUpResult?.result;
  if (result) return result === 'sin_novedades' ? 'Operativa · validación sin novedades' : result === 'nueva_falla' ? 'Detenida · nueva falla informada' : 'Validación pendiente';
  const explicit = update.metadata?.seguimiento?.outcome;
  if (explicit) return explicit === 'disponible' ? 'Operativa' : outcomeLabels[explicit] || 'Estado por confirmar';
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
  if (!meta.detentionStart || meta.intake?.pendingStart) questions.push({ field: 'meta', text: '¿Desde cuándo quedó detenida? El parte confirma la detención, no su inicio exacto.' });
  if (meta.intake?.pendingLocation) questions.push({ field: 'meta', text: '¿El mantenimiento se realiza en Boulogne o en un taller externo?' });
  if (detentionReason(event) === 'Por confirmar') questions.push({ field: 'meta', text: '¿Por qué quedó detenida?' });
  if (event.tipo === 'correctivo' && (meta.intake?.pendingSystem || missing(meta.system) || missing(meta.component))) questions.push({ field: 'meta', text: '¿Qué sistema y parte se intervinieron?' });
  if (!(event.actualizaciones || []).length) questions.push({ field: 'activity', text: '¿Se intervino? Indicá fecha, turno y personal, o el motivo por el que no se trabajó.' });
  for (const update of orderedUpdates(event)) {
    const t = update.metadata?.seguimiento || {};
    const add = text => questions.push({ update, text });
    if ((!t.activity || t.activity === 'sin_dato') && !update.metadata?.evidenceOnly && !update.metadata?.followUpResult) add('¿Se trabajó ese día?');
    if (['trabajo', 'mixto'].includes(t.activity) && missing(update.responsable)) add('¿Quién intervino?');
    if (['trabajo', 'mixto'].includes(t.activity) && t.workDurationDays == null && !(event.tipo === 'preventivo' && ['E', 'A', 'AB', 'ABC'].includes(event.preventivoCodigo))) add('¿Fue jornada completa o media jornada? La duración todavía no está confirmada.');
    if (['trabajo', 'mixto'].includes(t.activity) && event.tipo === 'correctivo' && (missing(t.system || meta.system) || missing(t.component || meta.component))) add('¿Qué parte se trabajó?');
    if (t.activity === 'mixto' && t.usefulFraction == null) add('¿Qué parte del día se trabajó y qué parte se perdió?');
    if (['espera', 'mixto'].includes(t.activity) && (!t.cause || t.cause === 'PENDIENTE')) add('¿Por qué no se pudo trabajar?');
  }
  if (outcomeAtEnd(event).code === 'pendiente') questions.push({ field: 'outcome', text: '¿Quedó operativa o continúa el mantenimiento?' });
  return questions;
}

export function operatingSegments(events, from, to) {
  const active = events.filter(isVisibleMaintenance);
  const windows = active.map(event => maintenanceWindow(event, to));
  const markers = [
    ...active.filter(event => event.estadoMantenimiento === 'finalizado').map(event => ({ date: shiftDay(event.fechaCierre || event.fecha, 1), time: '', manual: false, state: outcomeAtEnd(event).code === 'detenida' ? 'detenida' : 'operativa', source: `Mantenimiento finalizado el ${event.fechaCierre || event.fecha}`, id: event.id })),
    ...active.flatMap(event => orderedUpdates(event).filter(update => update.metadata?.followUpResult?.result === 'nueva_falla').map(update => ({ date: update.fecha, time: update.hora || '', manual: true, state: 'detenida', source: `Nueva falla del ${update.fecha}`, id: update.id }))),
    ...events.filter(event => !event.anulado && (event.metadata?.fleetConfirmation?.state || event.metadata?.dailyState?.state)).map(event => ({ date: event.fecha, time: event.hora || '', manual: true, state: event.metadata.dailyState?.state || event.metadata.fleetConfirmation.state, source: `${event.metadata.dailyState ? 'Parte diario' : 'Confirmación manual'} del ${event.fecha}`, id: event.id })),
  ].sort((a, b) => a.date.localeCompare(b.date) || Number(a.manual) - Number(b.manual) || a.time.localeCompare(b.time) || String(a.id).localeCompare(String(b.id)));
  const result = [];
  for (let day = from; day <= to; day = shiftDay(day, 1)) {
    if (windows.some(window => window.start <= day && day <= window.end)) continue;
    const marker = markers.filter(item => item.date <= day).at(-1);
    if (marker?.state !== 'operativa') continue;
    const previous = result.at(-1);
    if (previous && previous.end === shiftDay(day, -1)) previous.end = day;
    else result.push({ id: `${marker.id}-operativa-${day}`, start: day, end: day, kind: 'operativa', label: 'Operativa', reason: marker.source });
  }
  return result;
}
