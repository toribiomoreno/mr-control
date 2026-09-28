import { z } from 'zod';
import { today, shiftDay, fleet, normalizeUnit, causes, systems, staffOptions, periods, wholeLocomotive } from './types.js';
const date = z.string().refine(v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v, 'Fecha inválida');
const optionalDate = z.union([z.literal(''), date]);
const txt = z.string().max(6000);
const ident = z.string().min(1).max(120);
const unit = z.preprocess(v => typeof v === 'string' ? normalizeUnit(v) : v, z.string().refine(v => fleet.includes(v), 'Unidad no válida'));
export const episodeSchema = z.object({ id: ident, unit, start: optionalDate, end: optionalDate, confirmedThrough: date, scope: z.enum(['Boulogne', 'Externo']), notes: txt });
export const maintenanceSchema = z.object({ id: ident, unit, kind: z.enum(['liviano', 'pesado', 'correctivo']), subtype: z.string().max(20), reason: z.string().min(1).max(1000), system: z.string().refine(v => systems.includes(v)), component: z.string().max(300), staff: z.string().refine(v => staffOptions.includes(v)), location: z.string().min(1).max(100), start: optionalDate, end: optionalDate, status: z.enum(['abierto', 'finalizado']), episodeId: ident, notes: txt, questions: z.array(z.string().max(500)).max(30), savedQuestions: z.array(z.object({ id: ident, question: z.string().max(500), field: z.enum(['staff', 'system', 'component', 'detention', 'period', 'cause', 'activity', 'other']), observationIds: z.array(ident).max(40).optional() })).max(60).optional() });
export const observationSchema = z.object({ id: ident, maintenanceId: ident, date, period: z.string().refine(v => periods.includes(v)), activity: z.enum(['trabajo', 'espera', 'mixto', 'sin_dato']), task: txt, cause: z.string().refine(v => !v || Object.keys(causes).includes(v)), staff: z.string().refine(v => staffOptions.includes(v)), system: z.string().refine(v => systems.includes(v)), component: z.string().max(300), fullDay: z.boolean(), usefulFraction: z.union([z.literal(0), z.literal(0.5), z.literal(1)]).optional(), allocationNote: z.string().max(1000).optional(), weekendEligible: z.boolean().optional(), createdAt: z.string().max(80), updatedAt: z.string().max(80), source: z.string().max(300) });
const singleOperationSchema = z.discriminatedUnion('type', [z.object({ type: z.literal('observation'), observation: observationSchema }), z.object({ type: z.literal('maintenance'), maintenance: maintenanceSchema, episode: episodeSchema.optional() }), z.object({ type: z.literal('episode'), episode: episodeSchema })]);
export const operationSchema = z.union([singleOperationSchema, z.object({ type: z.literal('batch'), operations: z.array(singleOperationSchema).min(1).max(30) })]);
const upsert = (rows, item) => { const i = rows.findIndex(x => x.id === item.id); if (i < 0)
    rows.push(item);
else
    rows[i] = item; };
export function applyOperation(original, input, now = today()) {
    const op = operationSchema.parse(input);
    if (op.type === 'batch')
        return op.operations.reduce((state, operation) => applyOperation(state, operation, now), original);
    const s = structuredClone(original);
    const check = (d) => { if (d && d > now)
        throw new Error('No se pueden registrar hechos futuros.'); };
    if (op.type === 'observation') {
        const o = op.observation;
        const m = s.maintenances.find(x => x.id === o.maintenanceId);
        if (!m)
            throw new Error('Mantenimiento inexistente.');
        if (m.kind === 'liviano')
            Object.assign(o, wholeLocomotive);
        check(o.date);
        if (o.usefulFraction !== undefined) {
            if (o.activity !== 'mixto')
                throw new Error('El reparto del día se carga en Trabajo y espera.');
            if (!o.allocationNote?.trim())
                throw new Error('Explicá el criterio del reparto del día.');
            if (o.usefulFraction < 1 && (!o.cause || o.cause === 'PENDIENTE'))
                throw new Error('Indicá la causa de la parte perdida.');
            if (o.date === now && m.status !== 'finalizado')
                throw new Error('El reparto corresponde al día cerrado. Guardá la novedad y evaluá el día cuando termine.');
            if (s.observations.some(x => x.id !== o.id && x.maintenanceId === o.maintenanceId && x.date === o.date && x.usefulFraction !== undefined))
                throw new Error('Este día ya tiene un reparto. Corregí el registro que lo contiene.');
        }
        if (m.start && o.date < m.start)
            throw new Error('La actividad es anterior al inicio del mantenimiento. Corrigí primero el inicio.');
        if (m.end && o.date > m.end)
            throw new Error('El mantenimiento está finalizado. Corregí su cierre o abrí uno nuevo.');
        if (['trabajo', 'mixto'].includes(o.activity) && !o.task.trim())
            throw new Error('Indicá qué trabajo se realizó.');
        if (['espera', 'mixto'].includes(o.activity) && !o.cause)
            throw new Error('Seleccioná una causa de espera o Por confirmar.');
        if (o.fullDay && o.period !== 'Día completo')
            throw new Error('Para cerrar el día elegí Día completo.');
        if (o.date === now && o.fullDay) {
            throw new Error('El día de hoy sigue en curso. Registrá el período observado y cerrá el día cuando haya terminado.');
        }
        if (o.activity === 'espera' && o.fullDay && s.observations.some(x => x.id !== o.id && x.date === o.date && ['trabajo', 'mixto'].includes(x.activity) && x.maintenanceId === m.id))
            throw new Error('Ya hay trabajo registrado en este mantenimiento ese día. No puede marcarse como un día entero sin intervención.');
        if (['trabajo', 'mixto'].includes(o.activity) && s.observations.some(x => x.id !== o.id && x.date === o.date && x.activity === 'espera' && x.fullDay && x.maintenanceId === m.id))
            throw new Error('Hay un día completo sin intervención registrado. Corregí primero ese registro.');
        const stamp = new Date().toISOString();
        const prev = s.observations.find(x => x.id === o.id);
        if (prev && prev.maintenanceId !== o.maintenanceId)
            throw new Error('No se puede trasladar una observación a otro mantenimiento.');
        upsert(s.observations, { ...o, createdAt: prev?.createdAt || stamp, updatedAt: stamp, source: prev?.source || 'Carga personal' });
        const ep = s.episodes.find(x => x.id === m.episodeId);
        if (ep) {
            if (ep.end && o.date > ep.end)
                throw new Error('La fecha es posterior a la liberación de la locomotora.');
            if (o.activity !== 'sin_dato')
                ep.confirmedThrough = [ep.confirmedThrough, o.date].sort().at(-1);
        }
    }
    if (op.type === 'maintenance') {
        const m = op.maintenance;
        const previous = s.maintenances.find(j => j.id === m.id);
        if (previous && (previous.unit !== m.unit || previous.episodeId !== m.episodeId))
            throw new Error('No se puede trasladar un mantenimiento existente.');
        check(m.start);
        check(m.end);
        if (m.end && m.start && m.end < m.start)
            throw new Error('El fin debe ser posterior al inicio.');
        if (m.status === 'finalizado' && !m.end)
            throw new Error('Falta la fecha de finalización.');
        if (m.status === 'abierto' && m.end)
            throw new Error('Un mantenimiento abierto no lleva fecha final.');
        if (m.kind === 'liviano' && !['E', 'A', 'AB', 'ABC'].includes(m.subtype))
            throw new Error('Preventivo liviano inválido.');
        if (m.kind === 'pesado' && !/^N([1-9]|1[0-2])$/.test(m.subtype))
            throw new Error('Seleccioná N1 a N12.');
        if (m.kind !== 'correctivo')
            m.reason = 'Kilometraje';
        if (m.kind === 'liviano')
            Object.assign(m, wholeLocomotive);
        if (op.episode) {
            check(op.episode.start);
            check(op.episode.confirmedThrough);
            if (s.episodes.some(e => e.id === op.episode.id))
                throw new Error('La detención ya existe.');
            s.episodes.push(op.episode);
        }
        const ep = s.episodes.find(e => e.id === m.episodeId);
        if (!ep || ep.unit !== m.unit)
            throw new Error('Detención no válida para la locomotora.');
        if ((m.location === 'Boulogne') !== (ep.scope === 'Boulogne'))
            throw new Error('El lugar debe coincidir con el alcance de la detención.');
        if (m.start && ep.start && m.start < ep.start)
            throw new Error('El mantenimiento no puede empezar antes de la detención.');
        if (ep.end && m.start && m.start > ep.end)
            throw new Error('La detención seleccionada está cerrada.');
        if (s.observations.some(o => o.maintenanceId === m.id && ((m.start && o.date < m.start) || (m.end && o.date > m.end))))
            throw new Error('Las fechas dejarían actividades fuera del mantenimiento.');
        upsert(s.maintenances, m);
    }
    if (op.type === 'episode') {
        const e = op.episode;
        const prev = s.episodes.find(x => x.id === e.id);
        if (!prev || prev.unit !== e.unit || prev.scope !== e.scope)
            throw new Error('Detención no encontrada.');
        check(e.start);
        check(e.end);
        check(e.confirmedThrough);
        if (e.start && e.confirmedThrough < e.start)
            throw new Error('La última confirmación no puede ser anterior al inicio.');
        if (e.end && (!e.start || e.end < e.start || e.end < e.confirmedThrough))
            throw new Error('Revisá las fechas de detención y liberación.');
        const jobs = s.maintenances.filter(m => m.episodeId === e.id);
        if (e.end && jobs.some(m => m.status === 'abierto'))
            throw new Error('Finalizá primero los mantenimientos abiertos de esta detención.');
        if (jobs.some(m => m.start && e.start && m.start < e.start))
            throw new Error('Hay mantenimientos anteriores al inicio indicado.');
        if (e.end)
            e.confirmedThrough = e.end;
        upsert(s.episodes, e);
    }
    return s;
}
export function observationsFor(s, unit, date) { const ids = new Set(s.maintenances.filter(m => m.unit === unit && m.location === 'Boulogne').map(m => m.id)); return s.observations.filter(o => ids.has(o.maintenanceId) && o.date === date); }
export function isWeekend(d) { return [0, 6].includes(new Date(d + 'T12:00:00Z').getUTCDay()); }
export function indicatorEligible(s, unit, d, events = observationsFor(s, unit, d)) {
    if (!isWeekend(d))
        return true;
    if (events.some(o => o.activity === 'trabajo' || o.activity === 'mixto' || o.weekendEligible))
        return true;
    return s.maintenances.some(m => m.unit === unit && m.location === 'Boulogne' && m.kind === 'liviano' && !!m.start && m.start <= d && (!m.end || d <= m.end));
}
export function metrics(s, from, to, now = today()) {
    const cutoff = to < now ? to : shiftDay(now, -1);
    const days = new Map();
    const excluded = new Map();
    const unknownStart = s.episodes.filter(e => e.scope === 'Boulogne' && !e.start && e.confirmedThrough >= from);
    for (const e of s.episodes.filter(e => e.scope === 'Boulogne' && e.start)) {
        const start = e.start > from ? e.start : from;
        const stop = [e.end || e.confirmedThrough, cutoff].sort()[0];
        for (let d = start; d <= stop; d = shiftDay(d, 1)) {
            const key = e.unit + ':' + d;
            const events = observationsFor(s, e.unit, d);
            if (!indicatorEligible(s, e.unit, d, events)) {
                if (!days.has(key))
                    excluded.set(key, { unit: e.unit, date: d });
                continue;
            }
            excluded.delete(key);
            const state = events.some(o => ['trabajo', 'mixto'].includes(o.activity)) ? 'trabajo' : events.some(o => o.activity === 'espera' && o.fullDay) ? 'espera' : 'sin_dato';
            days.set(key, { unit: e.unit, date: d, state });
        }
    }
    const rows = [...days.values()];
    const worked = rows.filter(x => x.state === 'trabajo').length;
    const waited = rows.filter(x => x.state === 'espera').length;
    const missing = rows.length - worked - waited;
    const stale = s.episodes.filter(e => { if (e.scope !== 'Boulogne' || e.end || e.confirmedThrough >= cutoff || e.start > cutoff)
        return false; const start = [from, shiftDay(e.confirmedThrough, 1), e.start].sort().at(-1); for (let d = start; d <= cutoff; d = shiftDay(d, 1))
        if (indicatorEligible(s, e.unit, d))
            return true; return false; });
    const complete = rows.length > 0 && missing === 0 && unknownStart.length === 0 && stale.length === 0;
    return { rows, excluded: [...excluded.values()], total: rows.length, worked, waited, missing, complete, percent: complete ? Math.round(worked / rows.length * 100) : null, unknownStart: unknownStart.length, stale: stale.length, cutoff };
}
export function outstanding(s, from, to, now = today()) {
    const end = to < now ? to : now;
    const list = [];
    for (const unit of [...new Set(s.maintenances.filter(m => m.location === 'Boulogne').map(m => m.unit))]) {
        for (let d = from; d <= end; d = shiftDay(d, 1)) {
            const ep = s.episodes.find(e => e.unit === unit && e.scope === 'Boulogne' && (!e.start || e.start <= d) && (!e.end || e.end >= d));
            if (!ep)
                continue;
            const episodeJobs = s.maintenances.filter(m => m.episodeId === ep.id);
            if (!ep.start && episodeJobs.every(m => m.start && m.start > d))
                continue;
            const jobs = episodeJobs.filter(m => (!m.start || m.start <= d) && (!m.end || m.end >= d));
            const m = jobs[0] || episodeJobs[0];
            if (!m)
                continue;
            const ev = observationsFor(s, unit, d);
            if (!indicatorEligible(s, unit, d, ev))
                continue;
            if (!ev.length || ev.every(o => o.activity === 'sin_dato'))
                list.push({ unit, date: d, maintenanceId: m.id, message: d > ep.confirmedThrough ? 'Confirmar si continúa detenida o quedó operativa.' : '¿Se trabajó? Falta el registro del día.' });
            else if (ev.every(o => o.activity === 'espera' && !o.fullDay))
                list.push({ unit, date: d, maintenanceId: m.id, message: 'Espera parcial: falta confirmar el resto del día.' });
        }
    }
    return list;
}
