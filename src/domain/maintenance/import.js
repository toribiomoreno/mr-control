import { z } from 'zod';
import { maintenanceSchema, episodeSchema, observationSchema } from './logic.js';
import { validateEvent, validateUpdate } from './adapter.js';

const schema = z.object({ schemaVersion: z.literal(1), maintenances: z.array(maintenanceSchema).max(5000), episodes: z.array(episodeSchema).max(5000), observations: z.array(observationSchema).max(50000) });
export function preparePilotImport(input, existing = [], now) {
  const data = schema.parse(input.register || input.data || input);
  const seen = new Set();
  return data.maintenances.map(m => {
    const issues = [];
    const sourceId = 'piloto:' + m.id;
    if (seen.has(sourceId)) issues.push('ID repetido en el archivo.');
    seen.add(sourceId);
    const ep = data.episodes.find(e => e.id === m.episodeId);
    const siblings = data.maintenances.filter(x => x.episodeId === m.episodeId);
    const first = !siblings.some(x => x.start && x.start < m.start);
    const existingSource = existing.find(e => e.metadata?.pilotSourceId === sourceId);
    const event = {
      locomotoraCodigo: m.unit, fecha: m.start, hora: '06:00', tipo: m.kind === 'correctivo' ? 'correctivo' : 'preventivo',
      preventivoCodigo: m.kind === 'pesado' ? 'Numeral ' + m.subtype.slice(1) : m.subtype || null,
      titulo: m.kind === 'correctivo' ? m.reason : 'Preventivo ' + m.subtype, descripcion: m.reason + (m.notes ? '\n' + m.notes : ''),
      responsable: m.staff, especialidad: m.kind === 'correctivo' ? m.system : 'Todas', criticidad: 'baja', origen: 'manual',
      estadoMantenimiento: m.status === 'finalizado' ? 'finalizado' : 'en_curso', fechaCierre: m.end || null, horaCierre: m.end ? '22:00' : null,
      metadata: { pilotSourceId: sourceId, pilotOriginal: m, pilotEpisode: ep, horaEstimada: true, seguimiento: {
        detentionStart: first ? ep?.start || '' : m.start, confirmedThrough: ep?.confirmedThrough || '', availableDate: ep?.end || '', location: m.location, system: m.system, component: m.component,
      } },
    };
    if (!ep || ep.unit !== m.unit) issues.push('No coincide la detención con la unidad.');
    if (m.location !== 'Boulogne' && m.location !== 'Externo') event.metadata.seguimiento.location = ep?.scope === 'Externo' ? 'Externo' : m.location;
    try { validateEvent(event, now); } catch (e) { issues.push(e.message); }
    const actualizaciones = [];
    for (const o of data.observations.filter(o => o.maintenanceId === m.id)) {
      const a = { fecha: o.date, hora: o.period === 'Tarde' ? '14:00' : '06:00', tipoActualizacion: 'observacion', descripcion: o.task || 'Actividad sin detalle en el piloto.', responsable: o.staff, metadata: { pilotSourceId: o.id, pilotOriginal: o, horaEstimada: true, seguimiento: { ...o, period: o.staff === 'Turno fijo' && ['trabajo', 'mixto'].includes(o.activity) ? 'Mañana' : o.period } } };
      try { validateUpdate({ ...event, actualizaciones }, a, now); } catch (e) { issues.push(`${o.date}: ${e.message}`); }
      actualizaciones.push(a);
    }
    const possible = existing.find(e => !e.metadata?.pilotSourceId && e.locomotoraCodigo === event.locomotoraCodigo && e.fecha === event.fecha && e.tipo === event.tipo);
    if (possible) issues.push('Posible duplicado del historial. Revisar y vincular antes de importar.');
    return { sourceId, event, actualizaciones, issues, skipped: !!existingSource };
  });
}

export function previewPilotEvents(input, existing = [], now) {
  const rows = preparePilotImport(input, existing, now);
  const issues = rows.filter(row => row.issues.length);
  if (issues.length) throw new Error(`${issues.length} mantenimiento(s) requieren revisión. Corregí el archivo antes de mostrarlo.`);
  return rows.filter(row => !row.skipped).map(row => ({
    ...row.event,
    id: `vista:${row.sourceId}`,
    origen: 'vista-previa-privada',
    adjuntos: [],
    actualizaciones: row.actualizaciones.map((item, index) => ({
      ...item, id: `vista:${row.sourceId}:${index + 1}`,
      tipoActualizacion: item.tipoActualizacion,
    })),
  }));
}
