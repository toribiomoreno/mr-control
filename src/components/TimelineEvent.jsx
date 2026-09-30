import { useState } from 'react';
import { createSignedAttachmentUrl } from '../services/adjuntosSupabaseService.js';
import { isMaintenance } from '../domain/maintenance/adapter.js';
import { historyStaff } from '../domain/maintenance/history.js';
import { orderedUpdates, updateOutcomeLabel, workDurationLabel } from '../domain/maintenance/view.js';
import { dateLabel } from '../domain/maintenance/types.js';
import { dailyStateLabels } from '../domain/maintenance/dailyState.js';

const states = { abierto: 'EN CURSO', en_curso: 'EN CURSO', pausado: 'PAUSADO', finalizado: 'FINALIZADO', cancelado: 'CANCELADO' };
const activities = { trabajo: 'Se trabajó', espera: 'Sin intervención', mixto: 'Se trabajó parcialmente', sin_dato: 'Observación' };
const types = { preventivo: 'Preventivo', correctivo: 'Correctivo', libro: 'Libro de novedades', alistamiento: 'Alistamiento', lavado: 'Lavado', otro: 'Ajuste', campana: 'Campaña' };
const sameText = (a, b) => String(a || '').trim().toLocaleLowerCase('es') === String(b || '').trim().toLocaleLowerCase('es');

function Icon({ person = false }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{person ? <><circle cx="12" cy="7" r="3" /><path d="M5 21v-3a7 7 0 0 1 14 0v3" /></> : <path d="M14 5a5 5 0 0 0-6 6L2 17a3 3 0 0 0 5 5l6-6a5 5 0 0 0 6-6l-3 3-4-4 3-3Z" />}</svg>;
}

export default function TimelineEvent({ event }) {
  const [expanded, setExpanded] = useState(false);
  const updates = orderedUpdates(event);
  const maintenance = isMaintenance(event);
  const daily = event.metadata?.dailyState;
  const book = event.tipo === 'libro';
  const state = event.estadoMantenimiento || 'en_curso';
  const system = event.metadata?.seguimiento?.system || event.especialidad || types[event.tipo];
  const description = event.descripcion && !sameText(event.descripcion, event.titulo) && !updates.some(a => sameText(a.descripcion, event.descripcion)) ? event.descripcion : '';
  const detailId = `history-details-${event.id}`;
  async function openAttachment(attachment) {
    try {
      const url = attachment.storagePath ? await createSignedAttachmentUrl(attachment.storagePath) : attachment.url;
      if (url && url !== '#') window.open(url, '_blank', 'noopener,noreferrer');
    } catch { window.alert('No fue posible abrir el adjunto.'); }
  }
  const attachments = items => items?.length > 0 && <div className="timeline-event-meta">{items.map(a => <button key={a.id || a.storagePath || a.nombre} onClick={() => openAttachment(a)} type="button">{a.nombre || a.nombreArchivo || a.tipo || 'Ver adjunto'}</button>)}</div>;
  return <article className={`timeline-event-card ${event.tipo} ${daily ? `daily-state state-${daily.state}` : ''} ${event.criticidad === 'alta' ? 'is-critical' : ''}`}>
    <div className="timeline-event-marker" />
    <div className="timeline-event-body">
      <div className="history-event-summary">
        <span className="history-event-icon"><Icon /></span>
        <div className="history-event-copy">
          <div className="timeline-event-topline"><strong>{daily ? 'Estado diario de la máquina' : book ? 'Novedad · libro de turno' : event.titulo || types[event.tipo] || event.tipo}</strong>
            {maintenance && <em className={`maintenance-state-badge ${state}`}>{states[state] || state}</em>}
          </div>
          {daily || book ? <div className="timeline-event-meta">{daily && <span className="history-system">{dailyStateLabels[daily.state] || daily.state}</span>}{event.hora && <span>{event.hora.slice(0, 5)} h</span>}{book && event.nroLibro && <span>Registro {event.nroLibro}</span>}</div> : <div className="timeline-event-meta"><span className="history-system">{system}</span><span className="history-staff"><Icon person />{historyStaff(event)}</span></div>}
          {(daily?.observation || (book && event.descripcion)) && <p className="history-source-note">{daily ? daily.observation : event.descripcion}</p>}
          {book && event.metadata?.bookSource?.reviewNote && <small>{event.metadata.bookSource.reviewNote}</small>}
          {daily?.needsMaintenance && <small>Detención informada · ingreso a mantenimiento por completar.</small>}
        </div>
        <button className="history-expand-button" aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpanded(value => !value)} type="button">{expanded ? 'Ocultar' : 'Ver'} {maintenance ? `avances (${updates.length})` : 'detalle'} <span aria-hidden="true">{expanded ? '⌃' : '⌄'}</span></button>
      </div>
      {expanded && <div id={detailId} className="maintenance-update-list history-expanded-details">
        {daily?.conflict && <p>El parte informó {dailyStateLabels[daily.reportedState]}; se conserva detenida por el mantenimiento abierto. Confirmá su cierre antes de dar disponibilidad.</p>}
        {description && !daily && !book && (updates.length ? <details className="maintenance-update-item"><summary>Anotaciones del ingreso</summary><p>{description}</p></details> : <div className="maintenance-update-item"><strong>Anotaciones del registro</strong><p>{description}</p></div>)}
        {attachments(event.adjuntos)}
        {maintenance && !updates.length && <p className="maintenance-update-empty">Sin avances registrados. El ingreso no confirma que se haya trabajado.</p>}
        {updates.map(update => {
          const tracking = update.metadata?.seguimiento || {};
          return <div className="maintenance-update-item" key={update.id}>
            <div className="maintenance-update-item-heading"><strong>{dateLabel(update.fecha)}</strong><span>{tracking.period || 'Turno por confirmar'}{update.hora && !update.metadata?.horaEstimada ? ` · ${update.hora.slice(0, 5)}` : ''}</span><em>{activities[tracking.activity] || 'Avance'}</em></div>
            <p>{update.descripcion || update.motivoPausa}</p>
            {workDurationLabel(tracking) && <p>{workDurationLabel(tracking)}</p>}
            <div className="maintenance-update-data"><span>{[update.responsable || 'Personal por confirmar', tracking.staffSpecialty].filter(Boolean).join(' · ')}</span><span>{updateOutcomeLabel(event, update)}</span></div>
            {attachments(update.adjuntos)}
          </div>;
        })}
      </div>}
    </div>
  </article>;
}
