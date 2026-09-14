const filterTabs = [
  { id: 'todo', label: 'Todo' },
  { id: 'preventivo', label: 'Preventivos' },
  { id: 'correctivo', label: 'Correctivos' },
  { id: 'libro', label: 'Libro de novedades' },
  { id: 'alistamiento', label: 'Alistamientos' },
  { id: 'campana', label: 'Campanas' },
  { id: 'lavado', label: 'Lavados' },
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
        <button type="button">Filtros</button>
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
          >
            {item.label}
          </button>
        ))}
      </div>
      {dateRangeError && <p className="history-filter-error">{dateRangeError}</p>}
    </section>
  );
}
