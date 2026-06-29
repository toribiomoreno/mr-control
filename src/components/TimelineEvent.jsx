import { createSignedAttachmentUrl } from '../services/adjuntosSupabaseService.js';

const typeLabels = {
  preventivo: 'Preventivo',
  correctivo: 'Correctivo',
  libro: 'Libro de novedades',
  alistamiento: 'Alistamiento nocturno',
  campana: 'Campana',
  numeral: 'Numeral',
  lavado: 'Lavado',
  otro: 'Otro',
};

export default function TimelineEvent({ event }) {
  const openAttachment = async (adjunto) => {
    try {
      const url = adjunto.storagePath ? await createSignedAttachmentUrl(adjunto.storagePath) : adjunto.url;
      if (url && url !== '#') window.open(url, '_blank');
    } catch {
      window.alert('No fue posible abrir el adjunto.');
    }
  };

  return (
    <article className={`timeline-event-card ${event.tipo} ${event.criticidad === 'alta' ? 'is-critical' : ''}`}>
      <time>{event.hora}</time>

      <div className="timeline-event-marker" />

      <div className="timeline-event-body">
        <div className="timeline-event-topline">
          <strong>{event.titulo || typeLabels[event.tipo] || event.tipo}</strong>
          <span>{event.especialidad}</span>
          {event.automatico && <em>Automatico</em>}
        </div>

        <p>{event.descripcion}</p>

        <div className="timeline-event-meta">
          {event.responsable && <span>Responsable: {event.responsable}</span>}
          {(event.origen === 'sistema-ferrovias' || event.origen === 'libro-novedades-ferrovias') && <span>SINCRONIZADO</span>}
          {event.origen === 'calendario' && <span>CALENDARIO</span>}
          {(event.adjuntos || []).map((adjunto) => (
            <button key={`${event.id}-${adjunto.tipo}-${adjunto.nombre}`} onDoubleClick={() => openAttachment(adjunto)} type="button">{adjunto.tipo}</button>
          ))}
        </div>
      </div>
    </article>
  );
}
