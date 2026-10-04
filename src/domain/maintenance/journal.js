import { isLight } from './adapter.js';
import { orderedUpdates } from './view.js';
import { durations, dateLabel } from './types.js';

export function journalGroups(event) {
  const groups = [];
  let next = 1;
  for (const update of orderedUpdates(event)) {
    const t = update.metadata?.seguimiento || {};
    let key, label;
    if (isLight(event) && t.activity !== 'sin_dato' && !update.metadata?.followUpResult) {
      const number = t.shiftNumber || next;
      const count = t.workDurationShifts || (t.period === 'Mañana y tarde' ? 2 : 1);
      const extension = t.shiftExtended ? ` extendido${t.extensionIndex > 1 ? ` ${t.extensionIndex}` : ''}` : '';
      label = count > 1 ? `Turnos ${number}–${number + count - 1} · registro conjunto` : `Turno ${number}${extension}`;
      key = `${number}:${extension}`;
      if (!t.shiftExtended) next = Math.max(next, number + count);
    } else { key = update.fecha; label = dateLabel(update.fecha); }
    let group = groups.find(g => g.key === key);
    if (!group) { group = {key,label,date:update.fecha,updates:[]}; groups.push(group); }
    group.updates.push(update);
  }
  if (!isLight(event)) groups.forEach((g,i) => { g.label = `Día ${i+1} · ${dateLabel(g.date)}`; });
  return groups;
}
export function nextShiftNumber(event) {
  const used = journalGroups(event).flatMap(g=>g.updates).filter(a=>!a.metadata?.seguimiento?.shiftExtended && a.metadata?.seguimiento?.activity !== 'sin_dato');
  return Math.min(durations[event.preventivoCodigo] || 1, used.reduce((n,a)=>Math.max(n,a.metadata?.seguimiento?.shiftNumber ? a.metadata.seguimiento.shiftNumber + 1 : n + (a.metadata?.seguimiento?.workDurationShifts || (a.metadata?.seguimiento?.period === 'Mañana y tarde' ? 2 : 1))),1));
}
export function shiftEfficiency(event) {
  if (!isLight(event)) return null;
  const groups = journalGroups(event).filter(g=>g.updates.some(a=>a.metadata?.seguimiento?.activity !== 'sin_dato'));
  const registered = groups.reduce((n,g)=>n + Math.max(...g.updates.map(a=>a.metadata?.seguimiento?.workDurationShifts || (a.metadata?.seguimiento?.period === 'Mañana y tarde' ? 2 : 1))),0);
  const planned = durations[event.preventivoCodigo];
  return { planned, registered, extensions: groups.filter(g=>g.updates.some(a=>a.metadata?.seguimiento?.shiftExtended)).length, percent: event.estadoMantenimiento === 'finalizado' && registered >= planned ? Math.round(planned/registered*100) : null };
}
