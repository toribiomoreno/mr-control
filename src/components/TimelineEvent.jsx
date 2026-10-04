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

function Icon({ kind = 'note' }) {
  return <svg data-icon={kind} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{
    kind === 'person' ? <><circle cx="12" cy="7" r="3" /><path d="M5 21v-3a7 7 0 0 1 14 0v3" /></>
    : kind === 'wrench' ? <path d="M14 5a5 5 0 0 0-6 6L2 17a3 3 0 0 0 5 5l6-6a5 5 0 0 0 6-6l-3 3-4-4 3-3Z" />
    : kind === 'book' ? <><path d="M5 3h14v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM6 3v18M9 7h7M9 11h7M9 15h4" /></>
    : kind === 'daily' ? <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M7 15l3 3 6-5" /></>
    : <><path d="M14 3H5v18h14V8ZM14 3v5h5M8 12h8M8 16h5" /></>
  }</svg>;
}

export default function TimelineEvent({ event, onOpenMaintenance }) {
  const [expanded, setExpanded] = useState(false);
  const updates = orderedUpdates(event);
  const maintenance = isMaintenance(event);
  const daily = event.metadata?.dailyState;
  const book = event.tipo === 'libro';
  const state = event.estadoMantenimiento || 'en_curso';
  const system = event.metadata?.seguimiento?.intake?.pendingSystem ? 'Sistema por confirmar' : event.metadata?.seguimiento?.system || event.especialidad || types[event.tipo];
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
        <span className="history-event-icon"><Icon kind={daily ? 'daily' : book ? 'book' : maintenance ? 'wrench' : 'note'} /></span>
        <div className="history-event-copy">
          <div className="timeline-event-topline"><strong>{daily ? 'Estado diario de la máquina' : book ? 'Novedad · libro de turno' : event.tipo === 'alistamiento' ? `${event.locomotoraCodigo} · Alistamiento` : event.titulo || types[event.tipo] || event.tipo}</strong>
            {maintenance && <em className={`maintenance-state-badge ${state}`}>{states[state] || state}</em>}
          </div>
          {daily || book || event.tipo === 'alistamiento' ? <div className="timeline-event-meta">{daily && <span className="history-system">{dailyStateLabels[daily.state] || daily.state}</span>}{event.hora && <span>{event.hora.slice(0, 5)} h</span>}{book && event.nroLibro && <span>Registro {event.nroLibro}</span>}</div> : <div className="timeline-event-meta"><span className="history-system">{system}</span><span className="history-staff"><Icon kind="person" />{historyStaff(event)}</span>{maintenance && <span>{event.hora && !event.metadata?.horaEstimada ? `${event.hora.slice(0, 5)} h${event.metadata?.seguimiento?.intake ? ' · primer parte' : ''}` : 'Hora no informada'}</span>}</div>}
          {(daily?.observation || (['libro','alistamiento'].includes(event.tipo) && event.descripcion)) && <p className="history-source-note">{daily ? daily.observation : event.descripcion}</p>}
          {book && event.metadata?.bookSource?.reviewNote && <small>{event.metadata.bookSource.reviewNote}</small>}
          {daily?.needsMaintenance && <small>Detención informada · ingreso a mantenimiento por completar.</small>}
        </div>
        {maintenance && onOpenMaintenance && <button className="history-expand-button" onClick={onOpenMaintenance}>Abrir mantenimiento</button>}
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
