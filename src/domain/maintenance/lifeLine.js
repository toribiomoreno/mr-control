import { dateLabel, shiftDay, today } from './types.js';

const isMaintenance = (event) => ['preventivo', 'correctivo'].includes(event.tipo) && !event.anulado;
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '');

function inRange(start, end, from, to) {
  if (!validDate(start) || !validDate(end) || end < from || start > to) return null;
  return { start: start < from ? from : start, end: end > to ? to : end };
}

function toColumns(segment, days) {
  const first = days.indexOf(segment.start);
  const last = days.indexOf(segment.end);
  return { ...segment, column: first + 1, span: last - first + 1 };
}

export function buildLifeLine(events, endDate = today()) {
  const days = Array.from({ length: 14 }, (_, index) => shiftDay(endDate, index - 13));
  const from = days[0];
  const interventions = events.filter(isMaintenance).map((event) => {
    const tracking = event.metadata?.seguimiento || {};
    const start = validDate(tracking.detentionStart) ? tracking.detentionStart : event.fecha;
    const dates = [start, event.fecha, tracking.confirmedThrough, ...(event.actualizaciones || []).map((update) => update.fecha)]
      .filter(validDate).sort();
    const lastConfirmed = dates.at(-1) || start;
    const end = event.estadoMantenimiento === 'finalizado' && validDate(event.fechaCierre)
      ? event.fechaCierre : lastConfirmed;
    const available = validDate(tracking.availableDate) ? tracking.availableDate
      : ['servicio', 'disponible_con_observaciones'].includes(event.estadoUnidadResultante) && validDate(event.fechaCierre)
        ? event.fechaCierre : '';
    return { event, start, end: end < start ? start : end, available };
  }).sort((a, b) => a.start.localeCompare(b.start) || String(a.event.id).localeCompare(String(b.event.id)));

  const maintenance = interventions.flatMap(({ event, start, end }) => {
    const range = inRange(start, end, from, endDate);
    if (!range) return [];
    return [toColumns({ ...range, id: event.id, kind: event.tipo, label: event.titulo || (event.tipo === 'preventivo' ? `Preventivo ${event.preventivoCodigo}` : 'Correctivo'), reason: event.descripcion, confirmed: true }, days)];
  });

  // Verde únicamente después de una disponibilidad explícita y hasta la siguiente detención conocida.
  const operation = interventions.flatMap(({ available, event }) => {
    if (!available || event.estadoMantenimiento !== 'finalizado') return [];
    const start = shiftDay(available, 1);
    const nextStop = interventions.filter((item) => item.start >= start).map((item) => item.start).sort()[0];
    const end = nextStop ? shiftDay(nextStop, -1) : endDate;
    const range = inRange(start, end, from, endDate);
    return range ? [toColumns({ ...range, id: `${event.id}-available`, label: 'Operativa', reason: `Disponible desde ${dateLabel(available)}` }, days)] : [];
  });

  return { days, maintenance, operation, hasUnconfirmedDays: days.some((day) =>
    !maintenance.some((item) => item.start <= day && item.end >= day)
    && !operation.some((item) => item.start <= day && item.end >= day)) };
}
