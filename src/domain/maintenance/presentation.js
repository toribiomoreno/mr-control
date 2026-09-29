import { causes, dateLabel, shiftDay, today } from './types.js';
import { isWeekend } from './logic.js';
export const typeName = (m) => m.kind === 'liviano' ? 'Preventivo ' + m.subtype : m.kind === 'pesado' ? 'Numeral ' + m.subtype.slice(1) : 'Correctivo';
export const jobTitle = (m) => m.kind === 'correctivo' ? m.reason : typeName(m);
export const known = (value) => !!value && !/por confirmar|ubicación por confirmar/i.test(value);
export const dayLabel = (d) => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
export function eventsFor(s, m) { return s.observations.filter(o => o.maintenanceId === m.id).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)); }
export function displayRange(s, m, now = today()) {
    const events = eventsFor(s, m), ep = s.episodes.find(e => e.id === m.episodeId);
    return { start: m.start || events[0]?.date || ep?.start || '', end: m.end || now, unknownStart: !m.start };
}
export function weekJobs(s, week, now = today()) {
    const end = shiftDay(week, 6);
    return s.maintenances.filter(m => { const r = displayRange(s, m, now); return m.location === 'Boulogne' && (!r.start || r.start <= end) && r.end >= week; });
}
export function timelineLanes(s, jobs, week, now = today()) {
    const days = Array.from({ length: 7 }, (_, i) => shiftDay(week, i));
    const laneEnds = [];
    return jobs.map(m => ({ m, ...displayRange(s, m, now) })).sort((a, b) => (a.start || week).localeCompare(b.start || week) || a.m.id.localeCompare(b.m.id)).map(r => {
        const start = Math.max(0, days.findIndex(d => d >= (r.start || week)));
        const last = days.filter(d => d <= r.end).length - 1;
        const end = Math.min(6, Math.max(start, last));
        let lane = laneEnds.findIndex(x => x < start);
        if (lane < 0)
            lane = laneEnds.length;
        laneEnds[lane] = end;
        return { ...r, column: start + 1, span: end - start + 1, lane, continuesBefore: !!r.start && r.start < week };
    });
}
export function maintenanceEfficiency(s, m, range, now = today()) {
    const events = eventsFor(s, m), ep = s.episodes.find(e => e.id === m.episodeId);
    const siblings = s.maintenances.filter(j => j.episodeId === m.episodeId);
    const first = !siblings.some(j => j.id !== m.id && j.start && (!m.start || j.start < m.start));
    const start = first ? (ep?.start || m.start) : m.start;
    const unknownStart = !m.start || (first && !ep?.start);
    const closed = m.status === 'finalizado' && !!m.end;
    const dayComplete = events.some(o => o.date === now && o.dayComplete === true && (o.usefulFraction !== undefined || o.fullDay));
    const cutoff = closed ? m.end : dayComplete ? now : shiftDay(now, -1);
    const from = [start || events[0]?.date || range?.from || now, range?.from || ''].sort().at(-1);
    const to = [cutoff, range?.to || cutoff].sort()[0];
    const rows = [];
    // Bounded to avoid unbounded payloads for malformed historical dates.
    for (let d = from, n = 0; d <= to && n < 15000; d = shiftDay(d, 1), n++) {
        const ev = events.filter(o => o.date === d);
        const worked = ev.some(o => ['trabajo', 'mixto'].includes(o.activity));
        const eligible = !isWeekend(d) || m.kind === 'liviano' || worked || ev.some(o => o.weekendEligible);
        let state, reason;
        let useful = 0, lost = 0, lossCause = '';
        const assessment = ev.find(o => o.usefulFraction !== undefined);
        if (!eligible) {
            state = 'excluded';
            reason = 'Fin de semana sin intervención ni trabajo excepcional previsto.';
        }
        else if (!closed && ep && d > ep.confirmedThrough && !ev.some(o => o.activity !== 'sin_dato')) {
            state = 'unknown';
            reason = 'Falta confirmar si continuaba detenida o ya estaba operativa.';
        }
        else if (assessment) {
            useful = assessment.usefulFraction;
            lost = 1 - useful;
            lossCause = lost ? assessment.cause : '';
            state = useful === 1 ? 'worked' : useful === 0 ? 'wait' : 'mixed';
            reason = assessment.allocationNote || 'Reparto confirmado del día.';
        }
        else if (ev.some(o => o.activity === 'mixto') || (worked && ev.some(o => o.activity === 'espera'))) {
            state = 'unknown';
            reason = 'Hubo trabajo y espera. Falta evaluar qué parte del día fue útil y cuál se perdió.';
        }
        else if (worked) {
            state = 'worked';
            useful = 1;
            reason = ev.filter(o => ['trabajo', 'mixto'].includes(o.activity)).map(o => o.task).join(' · ');
        }
        else if (ev.some(o => o.activity === 'espera' && o.fullDay)) {
            state = 'wait';
            lost = 1;
            const codes = [...new Set(ev.filter(o => o.activity === 'espera').map(o => o.cause || 'PENDIENTE'))];
            lossCause = codes.length === 1 ? codes[0] : 'MULTIPLE';
            reason = codes.map(c => causes[c] || 'Causa no informada').join(' · ');
        }
        else {
            state = 'unknown';
            reason = ev.some(o => o.activity === 'espera') ? 'Hay una espera parcial; falta confirmar el resto del día.' : 'No hay actividad confirmada para este mantenimiento.';
        }
        rows.push({ date: d, state, reason, events: ev, useful, lost, lossCause });
    }
    if (!closed && !dayComplete && (!range || range.from <= now && range.to >= now) && (!m.start || m.start <= now))
        rows.push({ date: now, state: 'open', reason: 'Día en curso. Se incorpora al terminar el día o cerrar el mantenimiento.', events: events.filter(o => o.date === now), useful: 0, lost: 0, lossCause: '' });
    const worked = rows.reduce((n, r) => n + r.useful, 0), waited = rows.reduce((n, r) => n + r.lost, 0), missing = rows.filter(r => r.state === 'unknown').length, excluded = rows.filter(r => r.state === 'excluded').length;
    const losses = rows.reduce((a, r) => { if (r.lost)
        a[r.lossCause] = (a[r.lossCause] || 0) + r.lost; return a; }, {});
    const total = worked + waited + missing;
    const percent = total && !missing && !unknownStart ? Math.round(worked / total * 100) : null;
    return { rows, worked, waited, missing, excluded, total, losses, percent, unknownStart, from, to, closed, reason: unknownStart ? 'Falta confirmar desde cuándo estuvo detenida para esta intervención.' : missing ? `${missing} día(s) sin información suficiente.` : !total ? 'Aún no hay días cerrados para calcular.' : `${formatDays(worked)} días útiles de ${formatDays(total)} incluidos.`, truncated: rows.length >= 15000 };
}
export function completionQuestions(s, m) {
    const events = eventsFor(s, m), ep = s.episodes.find(e => e.id === m.episodeId), q = [];
    if (m.kind !== 'liviano' && !known(m.system) && !events.some(o => known(o.system)))
        q.push({ id: m.id + '-system', field: 'system', question: '¿En qué sistema se trabajó?' });
    if (m.kind !== 'liviano' && !known(m.component) && !events.some(o => known(o.component)))
        q.push({ id: m.id + '-component', field: 'component', question: '¿Qué parte o componente se intervino?' });
    if (!ep?.start)
        q.push({ id: m.id + '-detention', field: 'detention', question: '¿Desde qué fecha quedó detenida?' });
    const unknownStaff = events.filter(o => ['trabajo', 'mixto'].includes(o.activity) && !known(o.staff) && !known(m.staff));
    for (const date of [...new Set(unknownStaff.map(o => o.date))])
        q.push({ id: m.id + '-staff-' + date, field: 'staff', question: '¿Quién la trabajó el ' + dateLabel(date) + '?', observationIds: unknownStaff.filter(o => o.date === date).map(o => o.id) });
    if (!events.length && !known(m.staff))
        q.push({ id: m.id + '-staff', field: 'staff', question: '¿Quién está a cargo del trabajo?' });
    return q;
}
export function observationQuestions(o, m) {
    const q = [];
    const add = (field, question) => q.push({ id: o.id + '-' + field, field, question: dateLabel(o.date) + ' · ' + question, observationIds: [o.id] });
    if (['trabajo', 'mixto'].includes(o.activity)) {
        if (m?.kind !== 'liviano' && !known(o.staff))
            add('staff', '¿Quién la trabajó?');
        if (m?.kind !== 'liviano' && !known(o.system))
            add('system', '¿En qué sistema se trabajó?');
        if (m?.kind !== 'liviano' && !known(o.component))
            add('component', '¿Qué parte se intervino?');
    }
    if (['espera', 'mixto'].includes(o.activity) && o.cause === 'PENDIENTE')
        add('cause', '¿Por qué no se pudo trabajar?');
    if (o.activity === 'mixto' && o.usefulFraction === undefined)
        add('activity', '¿Qué parte del día fue útil y qué parte se perdió?');
    if (o.activity === 'sin_dato')
        add('activity', '¿Se trabajó ese día?');
    return q;
}
export const formatDays = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(n);
export const causeName = (code) => code === 'MULTIPLE' ? 'Varias causas sin reparto' : causes[code] || 'Causa sin confirmar';
