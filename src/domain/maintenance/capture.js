import { isLight, validateEvent, validDate } from './adapter.js';
import { operationalOutcomes, trackingForCurrentState } from './view.js';
import { today, wholeLocomotive } from './types.js';
import { lightSchedule } from './schedule.js';

export const maintenanceTypes = ['Correctivo', 'E', 'A', 'AB', 'ABC', ...Array.from({ length: 12 }, (_, i) => `Numeral ${i + 1}`)];
export const intakeTime = event => event.metadata?.seguimiento?.detentionTime || (!event.metadata?.horaEstimada && !event.metadata?.seguimiento?.intake?.pendingStart ? event.hora?.slice(0, 5) : '') || '';

export function buildMaintenanceIntake(values) {
  if (!maintenanceTypes.includes(values.maintenanceType)) throw new Error('Elegí un tipo de mantenimiento válido.');
  if (values.startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.startTime)) throw new Error('La hora de ingreso no es válida.');
  const tipo = values.maintenanceType === 'Correctivo' ? 'correctivo' : 'preventivo';
  const reason = tipo === 'preventivo' ? 'Kilometraje' : (values.reason || '').trim();
  if (!reason) throw new Error('Completá el motivo del ingreso.');
  const event = { locomotoraCodigo: values.unit, tipo, preventivoCodigo: tipo === 'preventivo' ? values.maintenanceType : null, fecha: values.startDate, hora: values.startTime || null,
    titulo: tipo === 'correctivo' ? 'Correctivo' : `Preventivo ${values.maintenanceType}`, descripcion: reason, responsable: values.staff, especialidad: tipo === 'preventivo' ? 'Todas' : 'Otra', origen: 'manual', estadoMantenimiento: 'en_curso', actualizaciones: [],
    metadata: { seguimiento: { captureVersion: 6, detentionStart: values.startDate, detentionTime: values.startTime || '', detentionReason: reason, location: 'Boulogne', outcome: 'continua', system: values.system, subsystem: values.subsystem, component: values.subsystem } } };
  if (isLight(event)) { event.responsable = 'Turno rotativo'; Object.assign(event.metadata.seguimiento, wholeLocomotive); }
  const schedule = lightSchedule(event);
  if (schedule) Object.assign(event.metadata.seguimiento, { plannedStart: schedule.start, plannedStartTime: schedule.startTime, plannedEnd: schedule.end, plannedEndTime: schedule.endTime });
  validateEvent(event);
  return event;
}

// Esta edición solo modifica la identidad y el ingreso. Nunca reemplaza los avances.
export function editMaintenanceIntake(event, values) {
  const tipo = values.maintenanceType === 'Correctivo' ? 'correctivo' : 'preventivo';
  if (!maintenanceTypes.includes(values.maintenanceType)) throw new Error('Elegí un tipo de mantenimiento válido.');
  const tracking = event.metadata?.seguimiento || {};
  const reason = tipo === 'preventivo' ? 'Kilometraje' : (values.reason || '').trim();
  const next = { ...event, locomotoraCodigo: values.unit, tipo, preventivoCodigo: tipo === 'preventivo' ? values.maintenanceType : null, fecha: values.startDate, hora: values.startTime || null,
    metadata: { ...event.metadata, seguimiento: { ...tracking, detentionStart: values.startDate, detentionTime: values.startTime || '', detentionReason: reason, ...(tracking.intake ? { intake: { ...tracking.intake, pendingStart: !values.startTime } } : {}) } } };
  next.metadata.seguimiento = trackingForCurrentState(next, next.metadata.seguimiento);
  if (!reason) throw new Error('Completá el motivo del ingreso.');
  if (values.startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.startTime)) throw new Error('La hora de ingreso no es válida.');
  if (isLight(next) && next.responsable !== 'Turno rotativo') throw new Error('Este ingreso tiene otro personal registrado. No se puede convertir a un preventivo liviano sin revisar ese registro.');
  if (tipo !== event.tipo || next.preventivoCodigo !== event.preventivoCodigo) {
    // No reinterpretar silenciosamente bloques diarios como turnos ni viceversa.
    if (isLight(next) !== isLight(event) && event.actualizaciones?.some(a => a.metadata?.seguimiento?.activity !== 'sin_dato')) throw new Error('Hay avances diarios o por turno registrados. Revisalos antes de cambiar a un tipo que use otro seguimiento.');
  }
  if (event.actualizaciones?.some(a => a.fecha < values.startDate)) throw new Error('El ingreso no puede quedar después de un avance ya registrado.');
  validateEvent(next);
  return next;
}

export function buildProgress(event, initialUpdate, values) {
  const old = initialUpdate || {}, saved = old.metadata?.seguimiento || {};
  const light = isLight(event), observation = values.observation;
  const activity = observation ? 'sin_dato' : values.noWork ? 'espera' : values.delayed ? 'mixto' : 'trabajo';
  const outcome = values.outcome || saved.outcome || 'pendiente';
  const closes = event.estadoMantenimiento !== 'finalizado' && operationalOutcomes.includes(outcome);
  const type = closes ? 'cierre' : old.id ? old.tipoActualizacion : observation || event.estadoMantenimiento === 'finalizado' ? 'observacion' : activity === 'espera' ? 'pausa' : 'avance';
  if (values.endTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.endTime)) throw new Error('La hora de fin no es válida.');
  const metadata = { ...saved, captureVersion: 6, activity, outcome, outcomeConfirmed: values.outcomeConfirmed || (outcome === saved.outcome && saved.outcomeConfirmed) || false,
    confirmedUnknownActivity: observation, confirmedUnknownOutcome: outcome === 'pendiente',
    ...(observation ? {} : { cause: values.delayed ? values.cause : '', delayDescription: values.delayed ? (values.delayDescription || '').trim() : '', delayReported: Boolean(values.delayed),
      // Compatibilidad con los registros diarios existentes; no se solicita turno físico.
      period: light ? values.period || saved.period || 'Día completo' : values.staff === 'Turno fijo' && activity !== 'espera' ? 'Mañana' : saved.period || 'Día completo',
      ...(light ? { shiftNumber: Number(values.shiftNumber), shiftExtended: Boolean(values.shiftExtended), extensionIndex: values.extensionIndex || 1, workDurationShifts: saved.workDurationShifts || 1, shiftFinished: values.shiftFinished, additionalShiftRequired: values.additionalShiftRequired, extensionCause: values.additionalShiftRequired ? values.cause : '', extensionReason: values.additionalShiftRequired ? (values.delayDescription || '').trim() : '' } : { system: values.system, subsystem: values.subsystem, component: saved.system === values.system ? saved.component || values.subsystem : values.subsystem, legacyClassification: !!old.id && !values.subsystem, workDurationDays: values.noWork ? null : Number(values.duration), confirmedUnknownDuration: false }) }),
  };
  // Los repartos anteriores, especialidad, períodos y adjuntos se conservan al editar.
  // Si cambia la actividad, su reparto anterior queda como evidencia, no como cálculo vigente.
  if (saved.activity && saved.activity !== activity && (saved.usefulFraction != null || saved.fullDay)) {
    metadata.previousAssessment = { usefulFraction: saved.usefulFraction, allocationNote: saved.allocationNote, fullDay: saved.fullDay, activity: saved.activity };
    delete metadata.usefulFraction; metadata.fullDay = false;
  }
  if (!observation && saved.system && saved.system !== values.system && !light) metadata.previousClassification = { system: saved.system, subsystem: saved.subsystem, component: saved.component };
  if (!observation && !values.delayed && saved.cause) metadata.previousDelay = { cause: saved.cause, description: saved.delayDescription, activity: saved.activity };
  if (!observation && !light && values.noWork && values.date < today()) metadata.fullDay = true;
  if (values.delayed && (!values.cause || !values.delayDescription?.trim())) throw new Error('Completá el motivo y la descripción de la demora.');
  if (values.additionalShiftRequired && (!values.cause || !values.delayDescription?.trim())) throw new Error('Indicá por qué se agregó otro turno.');
  if (!observation && !light && !values.noWork && ![0.5, 1].includes(Number(values.duration))) throw new Error('Elegí jornada completa o media jornada.');
  if (!validDate(values.date) || values.date > today()) throw new Error('La fecha de trabajo no es válida.');
  return { ...old, eventoId: event.id, fecha: values.date, hora: (closes || type === 'cierre' ? values.endTime || old.hora : old.hora) || null, tipoActualizacion: type, descripcion: values.description.trim(), responsable: observation ? old.responsable || event.responsable : light ? 'Turno rotativo' : values.staff,
    porcentajeAvance: old.porcentajeAvance ?? null, estadoResultante: closes || type === 'cierre' ? 'finalizado' : type === 'pausa' ? 'pausado' : type === 'observacion' ? null : 'en_curso',
    motivoPausa: activity === 'espera' ? values.delayDescription : old.motivoPausa || null,
    estadoUnidadResultante: outcome === 'operativa' ? 'servicio' : ['prueba', 'prueba_parque', 'prueba_linea', 'operativa_prueba'].includes(outcome) ? 'pendiente_de_prueba' : outcome === 'acompanada' ? 'disponible_con_observaciones' : ['continua', 'detenida'].includes(outcome) ? 'fuera_de_servicio' : old.estadoUnidadResultante || null,
    metadata: { ...old.metadata, seguimiento: metadata } };
}
