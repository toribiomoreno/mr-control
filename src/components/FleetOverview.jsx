import { useState } from 'react';
import { fleetStatus, fleetStatusLabels, summarizeFleet } from '../domain/maintenance/fleetSummary.js';
import { dateLabel } from '../domain/maintenance/types.js';
import './fleet-overview.css';

export default function FleetOverview({ locomotoras = [], onImportDailyState, onOpenHistory, canManage, loading }) {
  const [filter, setFilter] = useState('todas');
  const [search, setSearch] = useState('');
  const counts = summarizeFleet(locomotoras);
  const latestReport = locomotoras.map(l => l.fechaHoraParte || '').sort().at(-1);
  const statusOrder = { detenida: 0, operativa: 1, uso_excepcional: 2, reserva: 3, sin_confirmar: 4 };
  const filtered = locomotoras.filter(l => (filter === 'todas' || fleetStatus(l.estado) === filter) && l.codigo.toLowerCase().includes(search.toLowerCase().trim()))
    .sort((a, b) => statusOrder[fleetStatus(a.estado)] - statusOrder[fleetStatus(b.estado)] || a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  return <section className="fleet-overview" aria-label="Estado del parque tractivo">
    <header className="fleet-toolbar"><div><h3>Disponibilidad para el servicio</h3><p>{latestReport ? `Último parte: ${dateLabel(latestReport.slice(0, 10))} · ${latestReport.slice(11, 16)}` : 'Sin parte diario cargado'} · estados actualizados con los mantenimientos</p></div>{canManage && <button className="secondary-action" onClick={onImportDailyState}>Cargar estado diario</button>}</header>
    {loading ? <p role="status">Cargando estado de la flota…</p> : <>
      <div className="fleet-list-tools"><div className="fleet-filters" aria-label="Filtrar locomotoras">{[['todas','Todas'],['operativa','Operativas'],['detenida','Detenidas'],['reserva','Reserva'],['uso_excepcional','Uso excepcional'],...(counts.sin_confirmar ? [['sin_confirmar','Sin confirmar']] : [])].map(([key,label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span>{key === 'todas' ? counts.total : counts[key]}</span></button>)}</div><input type="search" aria-label="Buscar locomotora" placeholder="Buscar equipo…" value={search} onChange={e => setSearch(e.target.value)} /></div>
      <p className="fleet-instruction">Doble clic en una fila para abrir su Archivo Histórico. También podés usar Enter o Ver historial.</p>
      <div className="fleet-table-scroll"><table className="fleet-table" aria-label="Listado del parque tractivo"><thead><tr><th scope="col">Locomotora</th><th scope="col">Estado</th><th scope="col">Observación</th><th scope="col">Archivo histórico</th></tr></thead><tbody>{filtered.map(loco => <tr key={loco.codigo} className={`fleet-unit ${fleetStatus(loco.estado)}`} tabIndex={0} aria-label={`${loco.codigo}, ${fleetStatusLabels[fleetStatus(loco.estado)]}`} onDoubleClick={() => onOpenHistory?.(loco)} onKeyDown={e => { if(e.target === e.currentTarget && e.key === 'Enter') onOpenHistory?.(loco); }}><th scope="row"><strong>{loco.codigo}</strong><small>{loco.fechaParte ? `${dateLabel(loco.fechaParte)} · ${loco.horaParte || 'hora no informada'}` : 'Sin parte diario'}</small></th><td><span className="fleet-status">{fleetStatusLabels[fleetStatus(loco.estado)]}</span></td><td>{loco.observacion || 'Sin observaciones'}</td><td><button type="button" onClick={() => onOpenHistory?.(loco)} aria-label={`Historial de ${loco.codigo}`}>Ver historial</button></td></tr>)}</tbody></table></div>
      <p className="fleet-list-count">{filtered.length === counts.total ? `${counts.total} locomotoras` : `${filtered.length} de ${counts.total} locomotoras`}</p>
      {!filtered.length && <p>No hay locomotoras para este filtro.</p>}
    </>}
  </section>;
}
