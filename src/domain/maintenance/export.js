import { jobTitle, maintenanceEfficiency, formatDays, causeName } from './presentation.js';
import { detentionReason, hasMaintenanceDelay, isVisibleMaintenance, isoWeek, maintenanceWindow, orderedUpdates, updateOutcomeLabel } from './view.js';
import { dateLabel, shiftDay, today } from './types.js';
import { lightSchedule } from './schedule.js';
export function csv(rows) {
    const cell = (v) => { const s = String(v); return '"' + (/^[\s]*[=+\-@]|^[\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"'; };
    return '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n');
}
export const maintenanceCsvHeaders = ['Semana', 'Máquina', 'Tipo de mantenimiento', 'Motivo', 'Fecha de detención', 'Fecha del día trabajado', 'Fecha de fin', 'Fecha de fin programada', 'Trabajo realizado', '¿Hubo demora?', 'Causa raíz de la demora', 'Estado al finalizar el día', 'Sistema', 'Subsistema'];
const distinct = values => [...new Set(values.filter(Boolean))];
export function maintenanceCsvRows(events, range, now = today()) {
    const rows = [];
    for (const event of events.filter(isVisibleMaintenance)) {
        const window = maintenanceWindow(event, now);
        const from = [window.start, range?.from || window.start].sort().at(-1);
        const to = [window.end, range?.to || now, now].sort()[0];
        const updates = orderedUpdates(event).filter(a => !a.metadata?.weeklySummary);
        const dates = new Set();
        for (let day = from; day <= to; day = shiftDay(day, 1)) {
            const weekday = new Date(day + 'T12:00:00Z').getUTCDay();
            if ((weekday !== 0 && weekday !== 6) || updates.some(a => a.fecha === day)) dates.add(day);
        }
        updates.filter(a => a.fecha >= (range?.from || window.start) && a.fecha <= (range?.to || now) && a.fecha <= now).forEach(a => dates.add(a.fecha));
        for (const date of [...dates].sort()) {
            let daily = updates.filter(a => a.fecha === date);
            const activity = daily.filter(a => ['trabajo', 'mixto', 'espera'].includes(a.metadata?.seguimiento?.activity));
            const results = daily.filter(a => a.metadata?.followUpResult);
            if (activity.length) daily = [...activity, ...results];
            else if (results.length) daily = results;
            const tracking = daily.map(a => a.metadata?.seguimiento || {});
            const work = daily.filter(a => ['trabajo', 'mixto'].includes(a.metadata?.seguimiento?.activity));
            const latest = daily.at(-1) || updates.filter(a => a.fecha < date && a.metadata?.seguimiento?.outcome).at(-1);
            const codes = distinct(tracking.filter(hasMaintenanceDelay).map(t => t.extensionCause || t.cause).filter(c => c !== 'PENDIENTE'));
            const meta = event.metadata?.seguimiento || {};
            const plannedEnd = event.tipo === 'preventivo' ? lightSchedule(event)?.end || meta.plannedEnd : '';
            const descriptions = distinct((work.length ? work : daily).map(a => a.descripcion));
            rows.push({ id: event.id, date, values: [
                isoWeek(date).number, event.locomotoraCodigo,
                event.tipo === 'preventivo' ? 'Preventivo ' + event.preventivoCodigo : 'Correctivo',
                detentionReason(event), dateLabel(window.start), dateLabel(date),
                event.fechaCierre ? dateLabel(event.fechaCierre) : '', plannedEnd ? dateLabel(plannedEnd) : '',
                descriptions.join(' · ') || 'Sin descripción de trabajo registrada.',
                tracking.some(hasMaintenanceDelay) ? 'Sí' : 'No', codes.map(c => `${c} · ${causeName(c)}`).join(' / '),
                latest ? updateOutcomeLabel(event, latest) : 'Sin confirmar',
                distinct(tracking.map(t => t.system || meta.system)).join(' · ') || meta.system || 'Sin confirmar',
                distinct(tracking.map(t => t.subsystem || meta.subsystem || t.component || meta.component)).join(' · ') || meta.subsystem || meta.component || 'Sin confirmar',
            ] });
        }
    }
    return rows.sort((a, b) => a.values[1].localeCompare(b.values[1], 'es', { numeric: true }) || a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id))).map(row => row.values);
}
export function maintenanceCsv(events, range, now = today()) {
    return csv([maintenanceCsvHeaders, ...maintenanceCsvRows(events, range, now)]);
}
export function efficiencyCsv(data, jobs, range, now = today()) {
    return csv([['Locomotora', 'ID mantenimiento', 'Mantenimiento', 'Desde', 'Hasta', 'Días útiles equivalentes', 'Días perdidos', 'Días incluidos', 'Días sin datos', 'Días excluidos', 'Eficiencia %', 'Pérdidas por causa', 'Explicación'], ...jobs.map(m => {
            const k = maintenanceEfficiency(data, m, range, now);
            return [m.unit, m.id, jobTitle(m), k.from, k.to < k.from ? '' : k.to, formatDays(k.worked), formatDays(k.waited), formatDays(k.total), k.missing, k.excluded, k.percent ?? '', Object.entries(k.losses).map(([c, n]) => `${c} · ${causeName(c)}: ${formatDays(n)}`).join(' | '), k.reason];
        })]);
}
