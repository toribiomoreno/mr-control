const filterTabs = [
  { id: 'todo', label: 'Todos' },
  { id: 'operativa', label: 'Operativa', color: '#22c55e' },
  { id: 'estado_diario', label: 'Estados diarios', color: '#e7e5df' },
  { id: 'correctivo', label: 'Correctivos', color: '#ef4444' },
  { id: 'preventivo', label: 'Preventivos', color: '#facc15' },
  { id: 'lavado', label: 'Lavados', color: '#7dd3fc' },
  { id: 'libro', label: 'Libro de turno', color: '#a78bfa' },
  { id: 'alistamiento', label: 'Alistamientos' },
  { id: 'campana', label: 'Campañas' },
  { id: 'otro', label: 'Ajustes' },
  { id: 'adjuntos', label: 'Adjuntos' },
];

export default function EventFilters({
  activeFilter,
  dateFrom,
  dateRangeError,
  dateTo,
  onClearDateRange,
  onDateFromChange,
  onDateToChange,
  onFilterChange,
  onApplyDates,
  onSearchChange,
  search,
}) {
  return (
    <section className="history-event-filters" aria-label="Filtros del archivo historico">
      <div className="history-filter-heading">
        <div>
          <span>Explorar historial</span>
          <strong>Filtros del archivo</strong>
        </div>
      </div>

      <div className="history-search-row">
        <input
          aria-label="Buscar en el historial"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar en el historial..."
          type="search"
          value={search}
        />
        <label className="history-date-field">
          <span>Fecha desde</span>
          <input
            max={dateTo || undefined}
            onChange={(event) => onDateFromChange(event.target.value)}
            type="date"
            value={dateFrom}
          />
        </label>
        <label className="history-date-field">
          <span>Fecha hasta</span>
          <input
            min={dateFrom || undefined}
            onChange={(event) => onDateToChange(event.target.value)}
            type="date"
            value={dateTo}
          />
        </label>
        <button disabled={Boolean(dateRangeError)} onClick={onApplyDates} type="button">Filtrar</button>
        <button className="history-clear-dates" disabled={!dateFrom && !dateTo} onClick={onClearDateRange} type="button">
          Limpiar fechas
        </button>
      </div>

      <div className="history-filter-tabs">
        {filterTabs.map((item) => (
          <button
            className={activeFilter === item.id ? 'active' : ''}
            key={item.id}
            onClick={() => onFilterChange(item.id)}
            type="button"
            aria-pressed={activeFilter === item.id}
          >
            {item.color && <i className="history-filter-dot" style={{ '--filter-color': item.color }} />}
            {item.label}
          </button>
        ))}
      </div>
      {dateRangeError && <p className="history-filter-error">{dateRangeError}</p>}
    </section>
  );
}
