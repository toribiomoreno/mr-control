import { useState } from 'react';

import EventFilters from './EventFilters.jsx';
import KpiCard from './KpiCard.jsx';
import TimelineEvent from './TimelineEvent.jsx';

function groupEventsByDate(events) {
  return events.reduce((groups, event) => {
    const existing = groups.find((group) => group.date === event.fecha);
    if (existing) {
      existing.events.push(event);
      return groups;
    }

    return [...groups, { date: event.fecha, label: formatDateLabel(event.fecha), events: [event] }];
  }, []);
}

function eventMatchesFilter(event, filter) {
  if (filter === 'todo') return true;
  if (filter === 'adjuntos') return (event.adjuntos || []).length > 0;
  if (filter === 'campana') return isCampaignType(event.tipo);
  return event.tipo === filter;
}

function eventMatchesSearch(event, search) {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  return [
    event.fecha,
    event.hora,
    event.especialidad,
    event.titulo,
    event.descripcion,
    event.responsable,
    event.tipo,
  ].join(' ').toLowerCase().includes(query);
}

function formatDateLabel(value) {
  const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const [year, month, day] = value.split('-');
  return `${day} ${months[Number(month) - 1]} ${year}`;
}

function hasAttachment(event, type) {
  return (event.adjuntos || []).some((adjunto) => adjunto.tipo === type);
}

function isCampaignType(type) {
  return ['campana', 'campaña'].includes(type);
}

export default function HistorialLocomotora({
  events,
  loadError,
  loading,
  loco,
  locomotiveImage,
  locomotoras,
  onLocomotiveChange,
  onRegisterEvent,
  onRetry,
}) {
  const [activeFilter, setActiveFilter] = useState('todo');
  const [search, setSearch] = useState('');
  const targetLoco = loco || locomotoras.find((item) => item.codigo === '7774') || locomotoras[0];
  const stateLabel = targetLoco.estado === 'servicio' ? 'En servicio' : targetLoco.estado === 'preventivo' ? 'Preventivo' : 'Correctivo';
  const locomotiveEvents = events
    .filter((event) => event.locomotoraCodigo === targetLoco.codigo)
    .sort((a, b) => `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`));
  const filteredEvents = locomotiveEvents.filter((event) => eventMatchesFilter(event, activeFilter) && eventMatchesSearch(event, search));
  const groupedEvents = groupEventsByDate(filteredEvents);
  const stats = {
    preventivo: locomotiveEvents.filter((event) => event.tipo === 'preventivo').length,
    correctivo: locomotiveEvents.filter((event) => event.tipo === 'correctivo').length,
    libro: locomotiveEvents.filter((event) => event.tipo === 'libro').length,
    alistamiento: locomotiveEvents.filter((event) => event.tipo === 'alistamiento').length,
    campana: locomotiveEvents.filter((event) => isCampaignType(event.tipo)).length,
    lavado: locomotiveEvents.filter((event) => event.tipo === 'lavado').length,
    pdf: locomotiveEvents.filter((event) => hasAttachment(event, 'PDF')).length,
    fotos: locomotiveEvents.filter((event) => hasAttachment(event, 'Foto')).length,
  };
  const latestPreventive = locomotiveEvents.find((event) => event.tipo === 'preventivo');
  const latestCorrective = locomotiveEvents.find((event) => event.tipo === 'correctivo');
  const attachmentCount = locomotiveEvents.reduce((total, event) => total + (event.adjuntos || []).length, 0);

  return (
    <main className="history-workspace">
      <section className="history-main-panel">
        <header className="history-file-header">
          <div>
            <p className="eyebrow">Archivo historico ferroviario</p>
            <h2>Archivo Historico de Locomotora</h2>
            <div className="history-title-row">
              <strong>{targetLoco.codigo}</strong>
              <span className={`history-state-badge ${targetLoco.estado}`}>{stateLabel}</span>
              <span className="history-sync-badge">Sincronizado</span>
            </div>
            <div className="history-loco-selector">
              <label>
                Maquina
                <select value={targetLoco.codigo} onChange={(event) => onLocomotiveChange(event.target.value)}>
                  {locomotoras.map((item) => <option key={item.codigo} value={item.codigo}>{item.codigo}</option>)}
                </select>
              </label>
              <span>{loading ? 'Cargando historial...' : 'Supabase'}</span>
            </div>
          </div>

          <button className="history-register-button" onClick={() => onRegisterEvent(targetLoco)} type="button">
            Registrar evento
          </button>
        </header>

        <section className="history-kpi-grid">
          <KpiCard label="Ultimo preventivo" tone="preventivo" value={latestPreventive ? formatDateLabel(latestPreventive.fecha) : 'Sin registro'} />
          <KpiCard label="Ultimo correctivo" tone="correctivo" value={latestCorrective ? formatDateLabel(latestCorrective.fecha) : 'Sin registro'} />
          <KpiCard label="Dias sin novedades" tone="libro" value="0" />
          <KpiCard label="Eventos historicos" tone="campana" value={locomotiveEvents.length} />
          <KpiCard label="Archivos asociados" tone="lavado" value={attachmentCount} />
        </section>

        <EventFilters
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          onSearchChange={setSearch}
          search={search}
        />

        <section className="history-timeline" aria-label="Linea de tiempo historica">
          {!loading && !loadError && groupedEvents.map((group) => (
            <div className="timeline-day" key={group.date}>
              <h3>{group.label}</h3>
              <div className="timeline-day-events">
                {group.events.map((event) => (
                  <TimelineEvent
                    event={event}
                    key={event.id}
                  />
                ))}
              </div>
            </div>
          ))}

          {loading && (
            <p className="history-empty large">Cargando historial...</p>
          )}

          {!loading && loadError && (
            <div className="history-empty large">
              <p>No fue posible conectarse con Supabase.</p>
              <button className="secondary-action" onClick={onRetry} type="button">Reintentar</button>
            </div>
          )}

          {!loading && !loadError && groupedEvents.length === 0 && (
            <p className="history-empty large">
              {locomotiveEvents.length === 0 ? 'No hay eventos registrados.' : 'No hay eventos para esos filtros.'}
            </p>
          )}
        </section>
      </section>

      <aside className="history-detail-panel">
        <div className={`history-loco-portrait ${targetLoco.codigo === '7774' ? 'blue' : 'red'}`}>
          <img alt={`Locomotora ${targetLoco.codigo}`} src={locomotiveImage(targetLoco)} />
        </div>

        <div className="history-detail-heading">
          <span>Locomotora</span>
          <strong>{targetLoco.codigo}</strong>
        </div>

        <dl className="history-current-data">
          <div><dt>Estado actual</dt><dd>{stateLabel}</dd></div>
          <div><dt>Kilometraje</dt><dd>{targetLoco.kilometraje}</dd></div>
          <div><dt>Modelo</dt><dd>{targetLoco.modelo}</dd></div>
          <div><dt>Proximo preventivo</dt><dd>{targetLoco.proximoPreventivo}</dd></div>
          <div><dt>Fecha estimada</dt><dd>{targetLoco.fechaEstimada}</dd></div>
          <div><dt>Base</dt><dd>{targetLoco.base}</dd></div>
        </dl>

        <div className="history-side-stats">
          <span><b>{stats.preventivo}</b> Preventivos</span>
          <span><b>{stats.correctivo}</b> Correctivos</span>
          <span><b>{stats.libro}</b> Libro de novedades</span>
          <span><b>{stats.alistamiento}</b> Alistamientos con novedad</span>
          <span><b>{stats.campana}</b> Campanas</span>
          <span><b>{stats.lavado}</b> Lavados</span>
          <span><b>{stats.pdf}</b> PDF asociados</span>
          <span><b>{stats.fotos}</b> Fotos</span>
        </div>

        <button className="history-annual-button" type="button">Ver resumen anual</button>
      </aside>
    </main>
  );
}
