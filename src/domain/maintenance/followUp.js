import { orderedUpdates } from './view.js';
import { shiftDay, today } from './types.js';

export const followUpLabels = { acompanada: 'Salida acompañada', prueba: 'Prueba pendiente' };
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function followUpKind(text) {
  const value = normalize(text);
  if (/\b(?:no (?:sale|salio|salida)|sin salida) acompanada\b/.test(value)) return '';
  if (/\b(?:sale|salio|salida|salir) acompanad[ao]\b/.test(value)) return 'acompanada';
  if (/\b(?:pendiente(?:s)? de (?:prueba|pruebas)|pruebas? (?:dinamicas? )?pendiente(?:s)?)\b/.test(value)) return 'prueba';
  return '';
}

export function followUpRequest({ key, codigo, date, kind, event, source }) {
  return { key, codigo, date, kind, event, source, dueDate: source === 'parte' ? date : shiftDay(date, 1), dueTime: '09:00' };
}

export function pendingFollowUps(events, asOf = today(), time = '23:59') {
  const requests = new Map();
  const resolutions = new Set();
  const resolvedThrough = new Map();
  const resolve = (event, result, date) => {
    resolutions.add(result.key);
    const current = resolvedThrough.get(event.locomotoraCodigo) || '';
    if (date > current) resolvedThrough.set(event.locomotoraCodigo, date);
  };
  for (const event of events.filter(event => !event.anulado)) {
    const diario = event.metadata?.dailyState;
    if (diario && event.fecha <= asOf) {
      const kind = followUpKind(diario.observation);
      if (kind) requests.set(`parte:${event.id}`, followUpRequest({ key: `parte:${event.id}`, codigo: event.locomotoraCodigo, date: event.fecha, kind, event, source: 'parte' }));
    }
    for (const update of orderedUpdates(event).filter(item => item.fecha <= asOf)) {
      const t = update.metadata?.seguimiento || {};
      const result = update.metadata?.followUpResult;
      if (result) {
        resolve(event, result, update.fecha);
        if (result.result === 'pendiente') requests.set(`avance:${update.id}`, { ...followUpRequest({ key: `avance:${update.id}`, codigo: event.locomotoraCodigo, date: update.fecha, kind: result.kind, event, source: 'mantenimiento' }), continuation: true });
      } else {
        const kind = ['acompanada','prueba_linea'].includes(t.outcome) ? 'acompanada' : ['operativa_prueba', 'prueba', 'prueba_parque'].includes(t.outcome) || update.estadoUnidadResultante === 'pendiente_de_prueba' ? 'prueba' : '';
        if (kind) requests.set(`avance:${update.id}`, followUpRequest({ key: `avance:${update.id}`, codigo: event.locomotoraCodigo, date: update.fecha, kind, event, source: 'mantenimiento' }));
      }
    }
    const result = event.metadata?.followUpResult;
    if (result && event.fecha <= asOf) {
      resolve(event, result, event.fecha);
      if (result.result === 'pendiente') requests.set(`parte:${event.id}`, { ...followUpRequest({ key: `parte:${event.id}`, codigo: event.locomotoraCodigo, date: event.fecha, kind: result.kind, event, source: 'mantenimiento' }), continuation: true });
    }
    if (!event.actualizaciones?.length && ['acompanada', 'operativa_prueba', 'prueba', 'prueba_parque', 'prueba_linea'].includes(event.metadata?.seguimiento?.outcome) && event.fecha <= asOf) {
      const kind = ['acompanada','prueba_linea'].includes(event.metadata.seguimiento.outcome) ? 'acompanada' : 'prueba';
      requests.set(`mantenimiento:${event.id}`, followUpRequest({ key: `mantenimiento:${event.id}`, codigo: event.locomotoraCodigo, date: event.fechaCierre || event.fecha, kind, event, source: 'mantenimiento' }));
    }
  }
  // Una sola pregunta por máquina: una nueva anotación de la misma salida no multiplica avisos.
  const byUnit = new Map();
  for (const request of [...requests.values()].filter(item => !resolutions.has(item.key)
    && !events.some(event => event.locomotoraCodigo === item.codigo && event.id !== item.event.id
      && ['preventivo','correctivo'].includes(event.tipo) && !event.anulado && event.estadoMantenimiento !== 'cancelado'
      && (event.metadata?.seguimiento?.detentionStart || event.fecha) > item.date && event.fecha <= asOf)
    && (!resolvedThrough.has(item.codigo) || item.date > resolvedThrough.get(item.codigo) || (item.continuation && item.date === resolvedThrough.get(item.codigo))))
    .sort((a, b) => a.date.localeCompare(b.date))) byUnit.set(request.codigo, request);
  return [...byUnit.values()].map(item => ({ ...item, due: `${item.dueDate} ${item.dueTime}` <= `${asOf} ${time}` }));
}
