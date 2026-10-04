import { useState } from 'react';
import { fleetStatus, fleetStatusLabels, summarizeFleet } from '../domain/maintenance/fleetSummary.js';
import { dateLabel } from '../domain/maintenance/types.js';
import './fleet-overview.css';

export default function FleetOverview({ locomotoras = [], onImportDailyState, onOpenHistory, canManage, loading }) {
  const [filter, setFilter] = useState('todas');
  const [search, setSearch] = useState('');
  const counts = summarizeFleet(locomotoras);
  const latestReport = locomotoras.map(l => l.fechaHoraParte || '').sort().at(-1);
  const filtered = locomotoras.filter(l => (filter === 'todas' || fleetStatus(l.estado) === filter) && l.codigo.toLowerCase().includes(search.toLowerCase().trim()));
  return <section className="fleet-overview" aria-label="Estado del parque tractivo">
    <header className="fleet-toolbar"><div><h3>Disponibilidad para el servicio</h3><p>{latestReport ? `Último parte: ${dateLabel(latestReport.slice(0, 10))} · ${latestReport.slice(11, 16)}` : 'Sin parte diario cargado'} · estados actualizados con los mantenimientos</p></div>{canManage && <button className="secondary-action" onClick={onImportDailyState}>Cargar estado diario</button>}</header>
    {loading ? <p role="status">Cargando estado de la flota…</p> : <>
      <div className="fleet-metrics">
        <article className={`fleet-coverage ${counts.balance < 0 ? 'has-shortfall' : ''}`}><span>Operativas / necesarias</span><div className="fleet-big-number"><strong>{counts.operativa}</strong><span>/ {counts.required}</span></div><p>15 formaciones + 1 locomotora de respaldo</p><div className="fleet-capacity-bar" role="progressbar" aria-label="Cobertura del servicio" aria-valuemin={0} aria-valuemax={16} aria-valuenow={Math.min(counts.operativa, 16)} aria-valuetext={`${counts.operativa} operativas de 16 necesarias`}><i style={{width:`${counts.coverage}%`}} /></div><b>{counts.balance < 0 ? `Faltan ${-counts.balance} para cubrir la necesidad` : counts.balance === 0 ? 'Necesidad cubierta' : `Necesidad cubierta · ${counts.balance} adicionales`}</b></article>
        <article className="fleet-metric detained"><span>Detenidas</span><strong>{counts.detenida}</strong><small>Fuera de servicio</small></article>
        <article className="fleet-metric reserve"><span>Reserva / uso excepcional</span><strong>{counts.reserva + counts.uso_excepcional}</strong><small>{counts.reserva} reserva · {counts.uso_excepcional} uso excepcional</small></article>
      </div>
      <div className="fleet-list-tools"><div className="fleet-filters" aria-label="Filtrar locomotoras">{[['todas','Todas'],['operativa','Operativas'],['detenida','Detenidas'],['reserva','Reserva'],['uso_excepcional','Uso excepcional'],...(counts.sin_confirmar ? [['sin_confirmar','Sin confirmar']] : [])].map(([key,label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span>{key === 'todas' ? counts.total : counts[key]}</span></button>)}</div><input type="search" aria-label="Buscar locomotora" placeholder="Buscar equipo…" value={search} onChange={e => setSearch(e.target.value)} /></div>
      <p className="fleet-instruction">Doble clic en una tarjeta para abrir su Archivo Histórico. También podés usar Enter o el enlace Historial.</p>
      <div className="fleet-cards">{filtered.map(loco => <article key={loco.codigo} className={`fleet-unit ${fleetStatus(loco.estado)}`} tabIndex={0} aria-label={`${loco.codigo}, ${fleetStatusLabels[fleetStatus(loco.estado)]}`} onDoubleClick={() => onOpenHistory?.(loco)} onKeyDown={e => { if(e.target === e.currentTarget && e.key === 'Enter') onOpenHistory?.(loco); }}><header><strong>{loco.codigo}</strong><span className="fleet-status">{fleetStatusLabels[fleetStatus(loco.estado)]}</span></header><p>{loco.observacion || 'Sin observaciones'}</p><footer><small>{loco.fechaParte ? `Parte ${dateLabel(loco.fechaParte)} · ${loco.horaParte || 'hora no informada'}` : 'Sin parte diario'}</small><button type="button" onClick={() => onOpenHistory?.(loco)} aria-label={`Historial de ${loco.codigo}`}>Historial ↗</button></footer></article>)}</div>
      {!filtered.length && <p>No hay locomotoras para este filtro.</p>}
    </>}
  </section>;
}
