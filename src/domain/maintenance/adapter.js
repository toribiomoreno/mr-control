import { fleet, normalizeUnit, today, wholeLocomotive } from './types.js';
import { beforeMaintenanceClosure, detentionReason, operationalOutcomes, outcomeLabels } from './view.js';

export const isMaintenance = e => ['preventivo', 'correctivo'].includes(e.tipo);
export const isLight = e => e.tipo === 'preventivo' && ['E', 'A', 'AB', 'ABC'].includes(e.preventivoCodigo);
export function toRegister(events) {
  const register = { schemaVersion: 1, maintenances: [], episodes: [], observations: [] };
  for (const event of events.filter(e => isMaintenance(e) && !e.anulado && e.estadoMantenimiento !== 'cancelado')) {
    const meta = event.metadata?.seguimiento || {};
    const light = isLight(event);
    const id = event.id;
    const observations = (event.actualizaciones || []).map(a => {
      const tracking = a.metadata?.seguimiento || {};
      return { id: a.id, maintenanceId: id, date: a.fecha, period: tracking.period || 'Período por confirmar', activity: tracking.activity || 'sin_dato', task: a.descripcion || '', cause: tracking.cause || '', staff: a.responsable || event.responsable || 'Por confirmar', system: tracking.system || meta.system || (light ? wholeLocomotive.system : 'Por confirmar'), component: tracking.component || meta.component || (light ? wholeLocomotive.component : 'Por confirmar'), fullDay: !!tracking.fullDay, dayComplete: tracking.dayComplete === true, workDurationDays: tracking.workDurationDays ?? null, confirmedUnknownDuration: !!tracking.confirmedUnknownDuration, staffSpecialty: tracking.staffSpecialty || '', ...(tracking.usefulFraction != null ? { usefulFraction: Number(tracking.usefulFraction) } : {}), allocationNote: tracking.allocationNote || '', weekendEligible: !!tracking.weekendEligible, createdAt: a.createdAt || '', updatedAt: a.updatedAt || '', source: 'Archivo Histórico' };
    });
    const confirmed = [meta.detentionStart || '', meta.confirmedThrough || '', ...observations.filter(o => o.activity !== 'sin_dato').map(o => o.date)].sort().at(-1);
    register.episodes.push({ id, unit: normalizeUnit(event.locomotoraCodigo), start: meta.detentionStart || '', end: event.estadoMantenimiento === 'finalizado' ? event.fechaCierre || meta.availableDate || event.fecha : '', confirmedThrough: confirmed, scope: meta.location === 'Boulogne' ? 'Boulogne' : 'Externo', notes: '' });
    register.maintenances.push({ id, unit: normalizeUnit(event.locomotoraCodigo), kind: event.tipo === 'correctivo' ? 'correctivo' : light ? 'liviano' : 'pesado', subtype: event.tipo === 'preventivo' ? light ? event.preventivoCodigo : 'N' + String(event.preventivoCodigo || '').replace(/\D/g, '') : '', reason: detentionReason(event), system: light ? wholeLocomotive.system : meta.system || 'Por confirmar', component: light ? wholeLocomotive.component : meta.component || 'Por confirmar', staff: light ? wholeLocomotive.staff : event.responsable || 'Por confirmar', location: meta.location || 'Ubicación por confirmar', start: event.fecha, end: event.estadoMantenimiento === 'finalizado' ? event.fechaCierre || '' : '', status: event.estadoMantenimiento === 'finalizado' ? 'finalizado' : 'abierto', episodeId: id, notes: event.descripcion || '', questions: [], savedQuestions: [] });
    register.observations.push(...observations);
  }
  return register;
}
function assert(condition, message) { if (!condition) throw new Error(message); }
export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function validateEvent(event, now = today()) {
  assert(fleet.includes(normalizeUnit(event.locomotoraCodigo)), 'La locomotora no pertenece a la flota.');
  assert(validDate(event.fecha) && event.fecha <= now, 'La fecha debe ser válida y no futura.');
  if (!isMaintenance(event)) return;
  const meta = event.metadata?.seguimiento;
  assert(meta, 'Completá los datos de seguimiento del mantenimiento.');
  if (meta.captureVersion >= 2) {
    assert(event.titulo?.trim() && event.descripcion?.trim(), 'Indicá el trabajo o intervención y describí la novedad.');
    assert(event.responsable?.trim() && event.responsable !== 'Por confirmar', 'Confirmá qué personal intervino o informa el ingreso.');
    assert(meta.outcome, '¿Cómo quedó la máquina después del registro?');
    if (event.tipo === 'correctivo') assert(meta.detentionReason?.trim(), '¿Por qué quedó detenida la máquina?');
  }
  if (meta.outcome) {
    assert(Object.hasOwn(outcomeLabels, meta.outcome) || meta.outcome === 'disponible', 'Confirmá cómo quedó la máquina.');
    assert(!(event.estadoMantenimiento === 'finalizado' && !operationalOutcomes.includes(meta.outcome)), 'Si finaliza el mantenimiento, la máquina queda operativa. Revisá el estado.');
    assert(!(operationalOutcomes.includes(meta.outcome) && event.estadoMantenimiento !== 'finalizado'), 'Si la máquina queda operativa, marcá este mantenimiento como finalizado.');
  }
  assert(['Boulogne', 'Externo'].includes(meta.location), 'Confirmá dónde se realiza el mantenimiento.');
  assert(validDate(meta.detentionStart) && meta.detentionStart <= event.fecha, 'Confirmá desde cuándo está detenida; debe ser anterior o igual al inicio.');
  if (meta.confirmedThrough) assert(validDate(meta.confirmedThrough) && meta.confirmedThrough <= now && meta.confirmedThrough >= meta.detentionStart, 'La última confirmación de detención no es válida.');
  if (meta.availableDate) assert(validDate(meta.availableDate) && meta.availableDate <= now && meta.availableDate >= meta.detentionStart && event.estadoMantenimiento === 'finalizado', 'La disponibilidad requiere una fecha válida y el mantenimiento cerrado.');
  if (event.tipo === 'preventivo') assert(/^(E|A|AB|ABC|Numeral ([1-9]|1[0-2]))$/.test(event.preventivoCodigo), 'Elegí un preventivo válido.');
  if (isLight(event)) assert(event.responsable === 'Turno rotativo', 'Los preventivos livianos corresponden al turno rotativo.');
  if (event.tipo === 'correctivo') assert(meta.system && meta.system !== 'Por confirmar' && meta.component?.trim(), 'Indicá el sistema y la parte atacada.');
  if (event.fechaCierre) assert(validDate(event.fechaCierre) && event.fechaCierre >= event.fecha && event.fechaCierre <= now, 'La fecha de cierre no es válida.');
  if (meta.captureVersion >= 2 && event.estadoMantenimiento === 'finalizado') assert(event.fechaCierre && (!meta.availableDate || meta.availableDate === event.fechaCierre), 'Confirmá una única fecha de cierre y disponibilidad.');
}
export function validateUpdate(event, update, now = today()) {
  assert(validDate(update.fecha) && update.fecha <= now && update.fecha >= event.fecha, 'La novedad debe estar entre el inicio del mantenimiento y hoy.');
  assert(update.descripcion?.trim(), 'Describí el trabajo o la observación.');
  const t = update.metadata?.seguimiento;
  assert(t && ['trabajo', 'espera', 'mixto', 'sin_dato'].includes(t.activity), 'Confirmá si hubo trabajo, espera o falta información.');
  if (t.captureVersion >= 2) {
    if (t.activity !== 'sin_dato' || update.tipoActualizacion === 'cierre') assert(t.outcome, '¿Quedó operativa o continúa el mantenimiento?');
    if (t.activity === 'sin_dato') assert(t.confirmedUnknownActivity, 'Confirmá que querés dejar la actividad sin información.');
    if (t.outcome === 'pendiente') assert(t.confirmedUnknownOutcome, 'Confirmá que querés dejar el estado posterior pendiente.');
  }
  if (t.outcome) {
    assert(Object.hasOwn(outcomeLabels, t.outcome) || t.outcome === 'disponible', 'Confirmá cómo quedó la máquina.');
    assert(!(update.tipoActualizacion === 'cierre' && !operationalOutcomes.includes(t.outcome)), 'Un cierre deja la locomotora operativa. Confirmá el resultado.');
    assert(!(t.outcome === 'continua' && event.estadoMantenimiento === 'finalizado' && !beforeMaintenanceClosure(event, update)), 'El cierre no puede indicar que continúa el mantenimiento. Para un avance anterior, confirmá su fecha.');
    assert(!(operationalOutcomes.includes(t.outcome) && event.estadoMantenimiento !== 'finalizado' && update.tipoActualizacion !== 'cierre'), 'El estado operativo requiere cerrar el mantenimiento.');
  }
  if (event.estadoMantenimiento === 'finalizado') {
    assert(update.tipoActualizacion === 'observacion' || (update.id && event.actualizaciones?.some(a => a.id === update.id && a.tipoActualizacion === update.tipoActualizacion)), 'El mantenimiento está cerrado; solo admite observaciones.');
    assert(t.activity === 'sin_dato' || update.fecha <= event.fechaCierre, 'No puede haber actividad después del cierre.');
  }
  if (update.tipoActualizacion === 'cierre') assert(!(event.actualizaciones || []).some(a => a.id !== update.id && a.fecha > update.fecha && a.metadata?.seguimiento?.activity !== 'sin_dato'), 'Hay actividad posterior a la fecha de cierre.');
  if (t.activity !== 'sin_dato') {
    if (event.tipo === 'correctivo' && ['trabajo', 'mixto'].includes(t.activity)) {
      const system = t.system || event.metadata?.seguimiento?.system;
      const component = t.component || event.metadata?.seguimiento?.component;
      assert(system && system !== 'Por confirmar' && component?.trim(), 'Confirmá sistema y parte atacada en esta novedad.');
    }
    assert(update.responsable?.trim() && (!(t.captureVersion >= 2) || update.responsable !== 'Por confirmar'), '¿Quién intervino o informó la espera?');
    assert(['Mañana', 'Tarde', 'Mañana y tarde', 'Día completo'].includes(t.period), 'Confirmá el turno relevado.');
    if (update.responsable === 'Turno fijo' && ['trabajo', 'mixto'].includes(t.activity)) assert(t.period === 'Mañana', 'El turno fijo se registra por la mañana.');
    if (isLight(event) && ['trabajo', 'mixto'].includes(t.activity)) assert(update.responsable === 'Turno rotativo', 'El preventivo liviano lo interviene el turno rotativo.');
  }
  if (t.captureVersion >= 3 && !isLight(event) && ['trabajo', 'mixto'].includes(t.activity)) assert([0.5, 1].includes(t.workDurationDays) || (t.workDurationDays == null && t.confirmedUnknownDuration), 'Confirmá la duración del trabajo o indicá que aún no se conoce.');
  if (['espera', 'mixto'].includes(t.activity)) assert(['MO', 'MAT', 'Acc', 'CAP', 'GES'].includes(t.cause), '¿Por qué no se pudo trabajar? Elegí una causa.');
  if (t.usefulFraction != null) {
    assert([0, .5, 1].includes(t.usefulFraction), 'El reparto del día debe ser 0, 50 o 100 %.');
    assert(t.allocationNote?.trim(), 'Explicá el reparto del día.');
    assert(update.fecha < now || update.tipoActualizacion === 'cierre' || event.estadoMantenimiento === 'finalizado' || t.dayComplete === true, 'El reparto se confirma al terminar el día o cerrar el mantenimiento.');
    assert(t.activity === 'mixto' ? t.usefulFraction === .5 : t.activity === 'trabajo' ? t.usefulFraction === 1 : t.activity === 'espera' && t.usefulFraction === 0, 'El reparto no coincide con la actividad.');
  }
  if (t.fullDay) {
    assert(t.activity === 'espera' && t.period === 'Día completo', 'Una espera de día completo requiere ese período.');
    assert(update.fecha < now || update.tipoActualizacion === 'cierre' || event.estadoMantenimiento === 'finalizado' || t.dayComplete === true, 'Hoy sigue en curso; registrá solo el período observado.');
  }
  const peers = (event.actualizaciones || []).filter(a => a.id !== update.id && a.fecha === update.fecha).map(a => a.metadata?.seguimiento || {});
  assert(!(t.usefulFraction != null && peers.some(p => p.usefulFraction != null)), 'Ya hay un reparto para este día: corregí el registro existente.');
  assert(!(t.fullDay && t.activity === 'espera' && peers.some(p => ['trabajo', 'mixto'].includes(p.activity))) && !(['trabajo', 'mixto'].includes(t.activity) && peers.some(p => p.fullDay && p.activity === 'espera')), 'Hay trabajo y una espera de día completo: corregí el registro existente y usá un día mixto.');
}
