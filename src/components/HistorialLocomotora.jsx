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

function toCalendarDay(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function eventMatchesDateRange(event, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;

  const eventDay = toCalendarDay(event.fecha);
  if (!eventDay) return false;
  if (dateFrom && eventDay < dateFrom) return false;
  if (dateTo && eventDay > dateTo) return false;
  return true;
}

function formatDateLabel(value) {
  const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const [year, month, day] = value.split('-');
  return `${day} ${months[Number(month) - 1]} ${year}`;
}

function isCampaignType(type) {
  return ['campana', 'campaña'].includes(type);
}

function displayState(loco) {
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
  canManage = false,
  events,
  loadError,
  loading,
  loco,
  locomotiveImage,
  locomotoras,
  onLocomotiveChange,
  onCreateActualizacion,
  onForbidden,
  onImportLibro,
  onRegisterEvent,
  onRetry,
}) {
  const [activeFilter, setActiveFilter] = useState('todo');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const targetLoco = loco || locomotoras.find((item) => item.codigo === '7774') || locomotoras[0];
  const currentState = displayState(targetLoco);
  const hasDateRange = Boolean(dateFrom || dateTo);
  const dateRangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const dateRangeError = dateRangeInvalid ? 'La fecha desde no puede ser posterior a la fecha hasta.' : '';
  const locomotiveEvents = events
    .filter((event) => event.locomotoraCodigo === targetLoco.codigo)
    .sort((a, b) => `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`));
  const filteredEvents = dateRangeInvalid
    ? []
    : locomotiveEvents.filter((event) => (
      eventMatchesFilter(event, activeFilter)
      && eventMatchesSearch(event, search)
      && eventMatchesDateRange(event, dateFrom, dateTo)
    ));
  const groupedEvents = groupEventsByDate(filteredEvents);
  const latestPreventive = locomotiveEvents.find((event) => event.tipo === 'preventivo');
  const latestCorrective = locomotiveEvents.find((event) => event.tipo === 'correctivo');

  const handleClearDateRange = () => {
    setDateFrom('');
    setDateTo('');
  };

  const handleLibroImport = async (inputEvent) => {
    const [file] = inputEvent.target.files || [];
    if (!file) return;

    setImportStatus('');

    if (!canManage) {
      onForbidden?.();
      inputEvent.target.value = '';
      return;
    }

    setIsImporting(true);

    try {
      const result = await onImportLibro(file);
      setImportStatus(`Importacion finalizada: ${result.created} creados, ${result.updated} actualizados, ${result.grupos} grupos procesados.`);
    } catch (error) {
      setImportStatus(error.message || 'No fue posible importar el libro de novedades.');
    } finally {
      setIsImporting(false);
      inputEvent.target.value = '';
    }
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

            <div className="history-hero-actions">
              {canManage && (
                <label className={`history-import-button ${isImporting ? 'is-loading' : ''}`}>
                  {isImporting ? 'Importando...' : 'Importar libro de novedades'}
                  <input accept=".csv,text/csv" disabled={isImporting} onChange={handleLibroImport} type="file" />
                </label>
              )}
              {canManage && (
                <button className="history-register-button" onClick={() => onRegisterEvent(targetLoco)} type="button">
                  Registrar evento
                </button>
              )}
            </div>
          </div>

          <div className={`history-hero-loco ${targetLoco.codigo === '7774' ? 'blue' : 'red'}`}>
            <img alt={`Locomotora ${targetLoco.codigo}`} src={locomotiveImage(targetLoco)} />
          </div>
        </header>

        {importStatus && (
          <div className="history-modal-note history-import-status">
            {importStatus}
          </div>
        )}

        <section className="history-kpi-grid">
          <KpiCard icon="C" label="Ultimo preventivo" tone="preventivo" value={latestPreventive ? formatDateLabel(latestPreventive.fecha) : 'Sin registro'} />
          <KpiCard icon="H" label="Ultimo correctivo" tone="correctivo" value={latestCorrective ? formatDateLabel(latestCorrective.fecha) : 'Sin registro'} />
          <KpiCard icon="D" label="Dias sin novedades" tone="libro" value="0" />
        </section>

        <EventFilters
          activeFilter={activeFilter}
          dateFrom={dateFrom}
          dateRangeError={dateRangeError}
          dateTo={dateTo}
          onFilterChange={setActiveFilter}
          onClearDateRange={handleClearDateRange}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
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
                    canManage={canManage}
                    event={event}
                    key={event.id}
                    onCreateActualizacion={onCreateActualizacion}
                    onForbidden={onForbidden}
                  />
                ))}
              </div>
            </div>
          ))}

          {loading && (
            <div className="history-empty large">
              <strong>Cargando historial...</strong>
            </div>
          )}

          {!loading && loadError && (
            <div className="history-empty large">
              <strong>Sin conexion al historial</strong>
              <p>No fue posible conectarse con Supabase.</p>
              <button className="secondary-action" onClick={onRetry} type="button">Reintentar</button>
            </div>
          )}

          {!loading && !loadError && !dateRangeInvalid && groupedEvents.length === 0 && (
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
