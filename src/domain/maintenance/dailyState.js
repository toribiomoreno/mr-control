import { isVisibleMaintenance } from './view.js';

export const dailyStateLabels = { operativa: 'Operativa', detenida: 'Detenida', reserva: 'Reserva', uso_excepcional: 'Uso excepcional' };
export const isDailyState = event => Boolean(event.metadata?.dailyState);
export const stateEvidence = event => event.metadata?.dailyState || event.metadata?.fleetConfirmation;
const stamp = (date, time = '') => `${date} ${time.slice(0, 5)}`;

export function maintenanceAt(events, code, date, time = '06:00') {
  return events.filter(event => event.locomotoraCodigo === code && isVisibleMaintenance(event)
    && (!event.metadata?.seguimiento?.detentionAfterReport
      || stamp(date, time) > stamp(event.metadata.seguimiento.detentionAfterReport.date, event.metadata.seguimiento.detentionAfterReport.time))
    && stamp(event.metadata?.seguimiento?.detentionStart || event.fecha, event.metadata?.seguimiento?.detentionTime || event.hora || '00:00') <= stamp(date, time)
    && (event.estadoMantenimiento !== 'finalizado'
      || stamp(event.fechaCierre || event.fecha, event.horaCierre || '23:59') > stamp(date, time)));
}

export function dailyStateRecord(row, events = []) {
  const active = maintenanceAt(events, row.unit, row.reportDate, row.reportTime);
  const conflict = active.length > 0 && row.newState !== 'detenida';
  return {
    reportedState: row.newState,
    state: active.length ? 'detenida' : row.newState,
    observation: row.reason || '',
    maintenanceIds: active.map(event => event.id),
    conflict,
    needsMaintenance: row.newState === 'detenida' && !active.length,
    classification: row.classification || '',
    preventiveCode: row.preventiveCode || '',
  };
}
