import { jobTitle, maintenanceEfficiency, formatDays, causeName } from './presentation.js';
import { today } from './types.js';
export function csv(rows) {
    const cell = (v) => { const s = String(v); return '"' + (/^[\s]*[=+\-@]|^[\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"'; };
    return '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n');
}
export function registerCsv(data) {
    return csv([['Locomotora', 'ID mantenimiento', 'Mantenimiento', 'Estado', 'Lugar', 'Detenida desde', 'Disponible desde', 'Inicio mantenimiento', 'Fin mantenimiento', 'Fecha novedad', 'Período', 'Actividad', 'Causa', 'Personal', 'Sistema', 'Componente', 'Trabajos', 'Día completo sin trabajo', 'Fracción útil confirmada del día', 'Criterio del reparto', 'Excepción fin de semana', 'Anotaciones mantenimiento'], ...data.maintenances.flatMap(m => {
            const e = data.episodes.find(e => e.id === m.episodeId);
            const observations = data.observations.filter(o => o.maintenanceId === m.id);
            return (observations.length ? observations : [undefined]).map(o => [m.unit, m.id, jobTitle(m), m.status, m.location, e?.start || '', e?.end || '', m.start, m.end, o?.date || '', o?.period || '', o?.activity || '', o?.cause || '', o?.staff || m.staff, o?.system || m.system, o?.component || m.component, o?.task || '', o?.fullDay ? 'Sí' : '', o?.usefulFraction === undefined ? '' : formatDays(o.usefulFraction), o?.allocationNote || '', o?.weekendEligible ? 'Sí' : '', m.notes]);
        })]);
}
export function efficiencyCsv(data, jobs, range, now = today()) {
    return csv([['Locomotora', 'ID mantenimiento', 'Mantenimiento', 'Desde', 'Hasta', 'Días útiles equivalentes', 'Días perdidos', 'Días incluidos', 'Días sin datos', 'Días excluidos', 'Eficiencia %', 'Pérdidas por causa', 'Explicación'], ...jobs.map(m => {
            const k = maintenanceEfficiency(data, m, range, now);
            return [m.unit, m.id, jobTitle(m), k.from, k.to < k.from ? '' : k.to, formatDays(k.worked), formatDays(k.waited), formatDays(k.total), k.missing, k.excluded, k.percent ?? '', Object.entries(k.losses).map(([c, n]) => `${c} · ${causeName(c)}: ${formatDays(n)}`).join(' | '), k.reason];
        })]);
}
