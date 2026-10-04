import { fleetState } from './fleetState.js';
import { fleetStatus, fleetStatusLabels } from './fleetSummary.js';
import { shiftDay, today } from './types.js';
import { maintenanceBars, operatingSegments } from './view.js';

export function buildLifeLine(events, endDate = today()) {
  const days = Array.from({ length: 14 }, (_, index) => shiftDay(endDate, index - 13));
  const from = days[0];
  const maintenance = maintenanceBars(events, from, endDate, endDate);
  const operation = operatingSegments(events, from, endDate).map(item => ({ ...item, column: days.indexOf(item.start) + 1, span: days.indexOf(item.end) - days.indexOf(item.start) + 1 }));
  const states = [];
  const code = events.find(e=>e.locomotoraCodigo)?.locomotoraCodigo || 'timeline';
  for (const day of days) {
    const snapshot = events.map(e=>({...e,locomotoraCodigo:e.locomotoraCodigo || code,actualizaciones:(e.actualizaciones || []).filter(a=>a.fecha<=day),...(e.fechaCierre > day ? {estadoMantenimiento:'en_curso',fechaCierre:null} : {})}));
    const current = fleetState({codigo:code},snapshot,day);
    const kind = fleetStatus(current.estado);
    if(kind === 'sin_confirmar') continue;
    const previous = states.at(-1);
    if(previous?.kind === kind && previous.end === shiftDay(day,-1)) { previous.end=day; previous.span++; }
    else states.push({id:`${kind}-${day}`,kind,label:fleetStatusLabels[kind],reason:current.fuenteEstado,start:day,end:day,column:days.indexOf(day)+1,span:1});
  }
  return { days, maintenance, operation, states, hasUnconfirmedDays: maintenance.some(item => item.unconfirmed) || days.some(day =>
    !maintenance.some(item => item.start <= day && item.end >= day)
    && !states.some(item => item.start <= day && item.end >= day)) };
}
