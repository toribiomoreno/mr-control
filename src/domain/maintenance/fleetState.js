import { isVisibleMaintenance, maintenanceWindow, outcomeAtEnd, detentionReason } from './view.js';
import { today } from './types.js';
import { maintenanceAt, stateEvidence } from './dailyState.js';

// Una fecha sin parte no convierte una locomotora en operativa.
export function fleetState(loco, events, asOf = today()) {
  const jobs = events.filter(e => e.locomotoraCodigo === loco.codigo && isVisibleMaintenance(e) && e.fecha <= asOf);
  const confirmations = events.filter(e => e.locomotoraCodigo === loco.codigo && !e.anulado && e.fecha <= asOf && stateEvidence(e)?.state);
  const latestConfirmation = [...confirmations].sort((a, b) => `${b.fecha} ${b.hora || ''}`.localeCompare(`${a.fecha} ${a.hora || ''}`))[0];
  const open = jobs.filter(e => e.estadoMantenimiento !== 'finalizado' && maintenanceWindow(e, asOf).start <= asOf)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const evidenceDate = e => [e.fechaCierre || '', e.fecha, e.metadata?.seguimiento?.confirmedThrough || '', ...(e.actualizaciones || []).filter(a => a.fecha <= asOf).map(a => a.fecha)].sort().at(-1);
  const last = [...jobs].sort((a, b) => evidenceDate(b).localeCompare(evidenceDate(a)))[0];
  const daily = confirmations.filter(e => e.metadata?.dailyState).sort((a, b) => `${b.fecha} ${b.hora || ''}`.localeCompare(`${a.fecha} ${a.hora || ''}`))[0];
  if (daily) loco = { ...loco, fechaParte: daily.fecha, horaParte: daily.hora?.slice(0, 5), fechaHoraParte: `${daily.fecha}T${daily.hora?.slice(0, 5) || '06:00'}` };
  const reportDate = loco.fechaParte <= asOf ? loco.fechaParte || '' : '';
  const lastMaintenanceDate = last ? evidenceDate(last) : '';
  if (reportDate && reportDate >= lastMaintenanceDate && !open.length && (!latestConfirmation || `${reportDate} ${loco.horaParte || ''}` > `${latestConfirmation.fecha} ${latestConfirmation.hora || ''}`)) {
    return { ...loco, estado: loco.estado === 'servicio' ? 'operativa' : loco.estado,
      estadoConfirmado: true, conflictoEstado: open.length > 0, fuenteEstado: `Parte del ${reportDate}${open.length ? ' · Revisar mantenimiento aún abierto' : ''}` };
  }
  if (open.length) {
    const job = open[0];
    const window = maintenanceWindow(job, asOf);
    const reportedDetained = daily?.metadata.dailyState.reportedState === 'detenida'
      && maintenanceAt([job], loco.codigo, daily.fecha, daily.hora?.slice(0, 5)).length > 0;
    const confirmedThrough = reportedDetained && daily.fecha > window.confirmedThrough ? daily.fecha : window.confirmedThrough;
    const unconfirmed = confirmedThrough < asOf;
    return { ...loco, estado: job.tipo, tipoPreventivo: job.preventivoCodigo || '',
      observacion: [detentionReason(job), daily?.metadata.dailyState.observation].filter(Boolean).join(' · '), lavadoProgramado: false,
      conflictoEstado: Boolean((daily && maintenanceAt([job], loco.codigo, daily.fecha, daily.hora?.slice(0, 5)).length && daily.metadata.dailyState.reportedState !== 'detenida') || (!daily && reportDate >= window.confirmedThrough && ['servicio', 'operativa'].includes(loco.estado))), estadoConfirmado: !unconfirmed, fuenteEstado: unconfirmed
        ? `Detención confirmada hasta ${confirmedThrough}; continuidad por confirmar`
        : `Mantenimiento desde ${window.start}${reportedDetained ? ` · continúa según parte del ${daily.fecha}` : ''}` };
  }
  const outcome = last ? outcomeAtEnd(last) : null;
  const outcomeStamp = outcome?.date ? `${outcome.date} ${outcome.time || '23:59'}` : '';
  if (latestConfirmation && `${latestConfirmation.fecha} ${latestConfirmation.hora?.slice(0, 5) || ''}` >= outcomeStamp) {
    const evidence = stateEvidence(latestConfirmation);
    return { ...loco, estado: evidence.state,
      observacion: evidence.observation ?? latestConfirmation.descripcion, lavadoProgramado: false,
      needsMaintenance: evidence.state === 'detenida',
      estadoConfirmado: true, fuenteEstado: `${latestConfirmation.metadata.dailyState ? 'Parte diario' : 'Confirmación manual'} del ${latestConfirmation.fecha} ${latestConfirmation.hora || ''}`.trim() };
  }
  if (last) {
    if (['operativa', 'acompanada', 'operativa_prueba'].includes(outcome.code)) {
      return { ...loco, estado: 'operativa', observacion: outcome.code === 'operativa' ? '' : outcome.label,
        lavadoProgramado: false, estadoConfirmado: true, fuenteEstado: `Resultado del ${outcome.date}` };
    }
    if (outcome.code === 'detenida') return { ...loco, estado: 'detenida', observacion: outcome.label, needsMaintenance: true, estadoConfirmado: true, fuenteEstado: `Resultado del ${outcome.date}` };
    return { ...loco, estado: 'sin_confirmar', observacion: 'Disponibilidad por confirmar',
      lavadoProgramado: false, estadoConfirmado: false, fuenteEstado: `Último mantenimiento: ${last.fechaCierre || last.fecha}` };
  }
  return { ...loco, estado: 'sin_confirmar', observacion: 'Sin parte ni mantenimiento confirmado',
    lavadoProgramado: false, estadoConfirmado: false, fuenteEstado: 'Sin estado actualizado' };
}

export function fleetFromTracking(locomotoras, events, asOf = today()) {
  return locomotoras.map(loco => fleetState(loco, events, asOf));
}
