import { isMaintenance } from './adapter.js';
import { maintenanceWindow, orderedUpdates } from './view.js';

const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
// Días recientes primero; dentro del día, del primer aviso a la intervención.
// Una hora desconocida no equivale a medianoche ni se presenta como una hora real.
export function compareHistoryEvents(a, b) {
  const date = event => isMaintenance(event) ? event.metadata?.seguimiento?.detentionStart || event.fecha : event.fecha;
  const time = event => (isMaintenance(event) && event.metadata?.seguimiento?.detentionTime) || (event.metadata?.horaEstimada ? '24:00' : event.hora?.slice(0, 5) || '24:00');
  const priority = event => event.tipo === 'libro' ? 0 : event.metadata?.dailyState ? 1 : 2;
  return date(b).localeCompare(date(a)) || time(a).localeCompare(time(b))
    || priority(a) - priority(b)
    || String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.id).localeCompare(String(b.id));
}
const dayLabel = value => {
  if (!value) return 'Fecha por confirmar';
  const [year, month, day] = value.split('-');
  return `${Number(day)} ${months[Number(month) - 1]} ${year}`;
};

export function historyDates(event) {
  const start = isMaintenance(event) ? event.metadata?.seguimiento?.detentionStart || event.fecha : event.fecha;
  const end = isMaintenance(event) && event.estadoMantenimiento === 'finalizado' ? event.fechaCierre || event.fecha : start;
  if (start === end) return dayLabel(start);
  if (start.slice(0, 7) === end.slice(0, 7)) return `${Number(start.slice(8))} – ${dayLabel(end)}`;
  return `${dayLabel(start)} – ${dayLabel(end)}`;
}

export function historyMatchesDates(event, from, to) {
  const { start, end } = isMaintenance(event) ? maintenanceWindow(event) : { start: event.fecha, end: event.fecha };
  return (!from || end >= from) && (!to || start <= to);
}

export function historyStaff(event) {
  const worked = orderedUpdates(event).filter(a => ['trabajo', 'mixto'].includes(a.metadata?.seguimiento?.activity));
  const people = [...new Set(worked.map(a => [a.responsable, a.metadata?.seguimiento?.staffSpecialty].filter(Boolean).join(' · ')).filter(Boolean))];
  return people.join(' / ') || (event.metadata?.seguimiento?.intake ? 'Ingreso desde parte diario · sin personal interviniente confirmado' : event.responsable) || 'Responsable por confirmar';
}

export function historyMatchesSearch(event, search) {
  const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const tracking = event.metadata?.seguimiento || {};
  return normalize([event.fecha, event.titulo, event.descripcion, event.especialidad, historyStaff(event), event.tipo,
    tracking.system, tracking.component, ...(event.actualizaciones || []).map(a => a.descripcion)].join(' ')).includes(normalize(search).trim());
}
