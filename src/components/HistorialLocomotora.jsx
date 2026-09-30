import RailwayLoader from './RailwayLoader.jsx';
import { useState } from 'react';

import EventFilters from './EventFilters.jsx';
import LocomotiveLifeLine from './LocomotiveLifeLine.jsx';
import TimelineEvent from './TimelineEvent.jsx';
import { historyDates, historyMatchesDates, historyMatchesSearch } from '../domain/maintenance/history.js';

function eventMatchesFilter(event, filter) {
  if (filter === 'todo') return true;
  if (filter === 'adjuntos') return (event.adjuntos || []).length > 0 || (event.actualizaciones || []).some(a => a.adjuntos?.length);
  if (filter === 'campana') return isCampaignType(event.tipo);
  if (filter === 'operativa') return event.metadata?.fleetConfirmation?.state === 'operativa' || event.metadata?.fleetConfirmation?.state === 'servicio';
  return event.tipo === filter;
}

function isCampaignType(type) {
  return ['campana', 'campaña'].includes(type);
}

function displayState(loco) {
  if (loco.estado === 'sin_confirmar') return { icon: '?', key: 'reserva', label: 'Sin estado confirmado' };
  const observation = String(loco.observacion || '').toLowerCase();
  if (loco.estado === 'detenida') return { icon: '!', key: 'detenida', label: 'Detenida' };
  if (loco.estado === 'operativa') return { icon: 'OK', key: 'servicio', label: 'Operativa' };
  if (loco.estado === 'uso_excepcional') return { icon: '!', key: 'uso-excepcional', label: 'Uso excepcional' };
  if (observation.includes('uso excepcional')) return { icon: '!', key: 'uso-excepcional', label: 'Uso excepcional' };
  if (loco.estado === 'reserva') return { icon: 'II', key: 'reserva', label: 'Reserva' };
  if (loco.estado === 'servicio') return { icon: 'OK', key: 'servicio', label: 'En servicio' };
  return { icon: 'T', key: 'mantenimiento', label: 'En mantenimiento' };
}

export default function HistorialLocomotora({
  events,
  loadError,
  loading,
  loco,
  locomotiveImage,
  locomotoras,
  onLocomotiveChange,
  onOpenMaintenance,
  onRetry,
}) {
  const [activeFilter, setActiveFilter] = useState('todo');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedDates, setAppliedDates] = useState({ from: '', to: '' });
  const [search, setSearch] = useState('');
  const targetLoco = loco || locomotoras.find((item) => item.codigo === 'E721') || locomotoras[0];
  const currentState = displayState(targetLoco);
  const hasDateRange = Boolean(dateFrom || dateTo);
  const dateRangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const dateRangeError = dateRangeInvalid ? 'La fecha desde no puede ser posterior a la fecha hasta.' : '';
  const locomotiveEvents = events
    .filter((event) => event.locomotoraCodigo === targetLoco.codigo)
    .sort((a, b) => `${b.metadata?.seguimiento?.detentionStart || b.fecha} ${b.hora || ''}`.localeCompare(`${a.metadata?.seguimiento?.detentionStart || a.fecha} ${a.hora || ''}`));
  const filteredEvents = dateRangeInvalid
    ? []
    : locomotiveEvents.filter((event) => (
      eventMatchesFilter(event, activeFilter)
      && historyMatchesSearch(event, search)
      && historyMatchesDates(event, appliedDates.from, appliedDates.to)
    ));

  const handleClearDateRange = () => {
    setDateFrom('');
    setDateTo('');
    setAppliedDates({ from: '', to: '' });
  };

  return (
    <main className="history-workspace">
      <section className="history-main-panel">
        <header className="history-file-header">
          <div className="history-hero-copy">
            <div className="history-hero-statusbar">
              <span className="history-external-sync">
                <b />
                Sincronizacion externa activa
              </span>
              <span>{loading ? 'Cargando historial...' : 'Supabase'}</span>
            </div>
            <p className="eyebrow">Archivo historico ferroviario</p>
            <h2>Archivo Historico de Locomotora</h2>
            <div className="history-title-row">
              <strong>{targetLoco.codigo}</strong>
              <span className={`history-state-badge ${currentState.key}`}>
                <i>{currentState.icon}</i>
                {currentState.label}
              </span>
            </div>
            <div className="history-loco-selector">
              <label>
                Maquina
                <select value={targetLoco.codigo} onChange={(event) => onLocomotiveChange(event.target.value)}>
                  {locomotoras.map((item) => <option key={item.codigo} value={item.codigo}>{item.codigo}</option>)}
                </select>
              </label>
            </div>

          </div>

          <div className={`history-hero-loco ${targetLoco.codigo === '7774' ? 'blue' : 'red'}`}>
            <img alt={`Locomotora ${targetLoco.codigo}`} src={locomotiveImage(targetLoco)} />
          </div>
        </header>

        {!loadError && <LocomotiveLifeLine events={locomotiveEvents} loading={loading} onOpenMaintenance={(id) => {
          const maintenance = locomotiveEvents.find((event) => event.id === id);
          onOpenMaintenance(id, targetLoco.codigo, maintenance?.fecha, maintenance?.metadata?.seguimiento?.location);
        }} />}

        <EventFilters
          activeFilter={activeFilter}
          dateFrom={dateFrom}
          dateRangeError={dateRangeError}
          dateTo={dateTo}
          onFilterChange={setActiveFilter}
          onApplyDates={() => setAppliedDates({ from: dateFrom, to: dateTo })}
          onClearDateRange={handleClearDateRange}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onSearchChange={setSearch}
          search={search}
        />

        <section className="history-timeline" aria-label="Linea de tiempo historica">
          <h3 className="history-events-heading">Eventos del historial</h3>
          {!loading && !loadError && filteredEvents.map(event => (
            <div className="timeline-day" key={event.id}>
              <div className="timeline-date"><span>{historyDates(event)}</span></div>
              <div className="timeline-day-events"><TimelineEvent event={event} /></div>
            </div>
          ))}

          {loading && (
            <div className="history-empty large">
              <RailwayLoader label="Cargando historial…" />
            </div>
          )}

          {!loading && loadError && (
            <div className="history-empty large">
              <strong>Sin conexion al historial</strong>
              <p>No fue posible conectarse con Supabase.</p>
              <button className="secondary-action" onClick={onRetry} type="button">Reintentar</button>
            </div>
          )}

          {!loading && !loadError && !dateRangeInvalid && filteredEvents.length === 0 && (
            <div className="history-empty large">
              <strong>Sin resultados</strong>
              <p>{hasDateRange ? 'No hay eventos registrados para ese rango de fechas.' : locomotiveEvents.length === 0 ? 'No hay eventos registrados.' : 'No hay eventos para esos filtros.'}</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
