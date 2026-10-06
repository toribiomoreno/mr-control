import { durations, shiftDay, today } from './types.js';

// Dos turnos de ocho horas: mañana y tarde. La noche nunca consume un turno.
export function lightSchedule(event) {
  const planned = event.tipo === 'preventivo' && durations[event.preventivoCodigo];
  if (!planned) return null;
  const tracking = event.metadata?.seguimiento || {};
  const work = (event.actualizaciones || []).filter(a => ['trabajo', 'mixto', 'espera'].includes(a.metadata?.seguimiento?.activity))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || ({ Mañana: 0, Tarde: 1 }[a.metadata.seguimiento.period] ?? 2) - ({ Mañana: 0, Tarde: 1 }[b.metadata.seguimiento.period] ?? 2));
  const first = work.find(a => a.metadata.seguimiento.shiftNumber === 1 && !a.metadata.seguimiento.shiftExtended);
  const time = tracking.plannedStartTime || tracking.detentionTime || (!event.metadata?.horaEstimada ? event.hora?.slice(0, 5) : '');
  const period = first?.metadata.seguimiento.period || (time >= '06:00' && time < '14:00' ? 'Mañana' : time >= '14:00' && time < '22:00' ? 'Tarde' : '');
  const start = first?.fecha || tracking.plannedStart || tracking.detentionStart || event.fecha;
  if (!start || !['Mañana', 'Tarde'].includes(period)) return null;
  const extensions = new Set();
  for (const a of work) {
    const t = a.metadata.seguimiento;
    if (t.shiftExtended) extensions.add(`${t.shiftNumber}:${t.extensionIndex || 1}`);
    if (t.additionalShiftRequired) extensions.add(`${t.shiftNumber}:${t.shiftExtended ? (t.extensionIndex || 1) + 1 : 1}`);
  }
  const slots = planned + extensions.size;
  const offset = (period === 'Tarde' ? 1 : 0) + slots - 1;
  return { start, startTime: period === 'Mañana' ? '06:00' : '14:00', end: shiftDay(start, Math.floor(offset / 2)), endTime: offset % 2 ? '22:00' : '14:00', endPeriod: offset % 2 ? 'Tarde' : 'Mañana', planned, extensions: extensions.size, slots };
}

// Suggest the actual scheduled slot when a historical shift is entered today.
export function lightShiftSlot(event, number = 1, extension = 0) {
  const plan = lightSchedule(event);
  if (!plan) return null;
  const offset = (plan.startTime === '14:00' ? 1 : 0) + Number(number) - 1 + extension;
  return { date: shiftDay(plan.start, Math.floor(offset / 2)), period: offset % 2 ? 'Tarde' : 'Mañana' };
}

export function nextWorkDate(event) {
  const dates = [event.fecha, ...(event.actualizaciones || []).filter(a => a.metadata?.seguimiento?.activity !== 'sin_dato').map(a => a.fecha)].filter(Boolean).sort();
  const next = shiftDay(dates.at(-1) || today(), 1);
  return [next, today(), ...(event.estadoMantenimiento === 'finalizado' ? [event.fechaCierre] : [])].filter(Boolean).sort()[0];
}
