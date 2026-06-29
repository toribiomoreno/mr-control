import { useState } from 'react';

import ActualizacionEventoModal from './ActualizacionEventoModal.jsx';
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

const estadoLabels = {
  abierto: 'EN CURSO',
  en_curso: 'EN CURSO',
  pausado: 'PAUSADO',
  finalizado: 'FINALIZADO',
  cancelado: 'CANCELADO',
};

const updateLabels = {
  avance: 'Avance',
  pausa: 'Pausa',
  reanudacion: 'Reanudacion',
  observacion: 'Observacion',
  cierre: 'Cierre',
};

function isMaintenanceEvent(type) {
  return ['preventivo', 'correctivo'].includes(type);
}

function normalizeMaintenanceState(state) {
  if (!state || state === 'abierto') return 'en_curso';
  return state;
}

function formatTime(value) {
  return value ? String(value).slice(0, 5) : '';
}

function updateDescription(actualizacion) {
  if (actualizacion.tipoActualizacion === 'pausa') {
    return actualizacion.motivoPausa || actualizacion.descripcion;
  }

  return actualizacion.descripcion;
}

export default function TimelineEvent({ event, onCreateActualizacion }) {
  const [showUpdates, setShowUpdates] = useState(false);
  const [modalMode, setModalMode] = useState('');
  const actualizaciones = event.actualizaciones || [];
  const isMaintenance = isMaintenanceEvent(event.tipo);
  const estadoMantenimiento = isMaintenance ? normalizeMaintenanceState(event.estadoMantenimiento) : '';
  const isFinished = estadoMantenimiento === 'finalizado';

  const openAttachment = async (adjunto) => {
    try {
      const url = adjunto.storagePath ? await createSignedAttachmentUrl(adjunto.storagePath) : adjunto.url;
      if (url && url !== '#') window.open(url, '_blank');
    } catch {
      window.alert('No fue posible abrir el adjunto.');
    }
  };

  return (
    <>
      <article className={`timeline-event-card ${event.tipo} ${event.criticidad === 'alta' ? 'is-critical' : ''}`}>
        <time>{formatTime(event.hora)}</time>

        <div className="timeline-event-marker" />

        <div className="timeline-event-body">
          <div className="timeline-event-topline">
            <strong>{event.titulo || typeLabels[event.tipo] || event.tipo}</strong>
            <span>{event.especialidad}</span>
            {event.automatico && <em>Automatico</em>}
            {isMaintenance && (
              <em className={`maintenance-state-badge ${estadoMantenimiento}`}>
                {estadoLabels[estadoMantenimiento] || estadoMantenimiento}
              </em>
            )}
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

          {isMaintenance && (
            <div className="maintenance-update-panel">
              <div className="maintenance-update-summary">
                <span>{actualizaciones.length} {isFinished ? 'actualizaciones' : 'avances'}</span>
                {event.fechaCierre && <span>Cierre: {event.fechaCierre} {formatTime(event.horaCierre)}</span>}
                {isFinished && <strong>Mantenimiento finalizado</strong>}
              </div>

              <div className="maintenance-update-actions">
                {!isFinished && (
                  <button className="secondary-action" onClick={() => setModalMode('avance')} type="button">
                    Agregar avance
                  </button>
                )}
                {isFinished && (
                  <button className="secondary-action" onClick={() => setModalMode('observacion')} type="button">
                    Agregar observacion
                  </button>
                )}
                {(isFinished || actualizaciones.length > 0) && (
                  <button className="secondary-action" onClick={() => setShowUpdates((current) => !current)} type="button">
                    {isFinished ? `Ver actualizaciones (${actualizaciones.length})` : `Ver avances (${actualizaciones.length})`}
                  </button>
                )}
              </div>

              {showUpdates && (
                <div className="maintenance-update-list">
                  {actualizaciones.length === 0 && (
                    <span className="maintenance-update-empty">
                      {isFinished ? 'Sin actualizaciones registradas.' : 'Sin avances registrados.'}
                    </span>
                  )}

                  {actualizaciones.map((actualizacion) => (
                    <div className="maintenance-update-item" key={actualizacion.id}>
                      <div className="maintenance-update-item-heading">
                        <strong>{updateLabels[actualizacion.tipoActualizacion] || actualizacion.tipoActualizacion}</strong>
                        <span>{actualizacion.fecha} {formatTime(actualizacion.hora)}</span>
                        {actualizacion.tipoActualizacion === 'cierre' && <em>FINALIZADO</em>}
                      </div>

                      <p>{updateDescription(actualizacion)}</p>

                      <div className="maintenance-update-data">
                        {actualizacion.responsable && <span>Responsable: {actualizacion.responsable}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </article>

      {modalMode && (
        <ActualizacionEventoModal
          event={event}
          mode={modalMode}
          onClose={() => setModalMode('')}
          onSave={onCreateActualizacion}
        />
      )}
    </>
  );
}
