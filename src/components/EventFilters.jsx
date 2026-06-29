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

export default function EventFilters({ activeFilter, onFilterChange, onSearchChange, search }) {
  return (
    <section className="history-event-filters" aria-label="Filtros del archivo historico">
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

      <div className="history-search-row">
        <input
          aria-label="Buscar en el historial"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar en el historial..."
          type="search"
          value={search}
        />
        <button type="button">Filtros</button>
      </div>
    </section>
  );
}
