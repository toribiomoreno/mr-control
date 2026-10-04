import { summarizeFleet } from '../domain/maintenance/fleetSummary.js';

export default function FleetMetrics({ locomotoras = [], loading }) {
  const counts = summarizeFleet(locomotoras);
  const number = value => loading ? '—' : value;
  return <div className="fleet-summary-metrics" aria-label="Resumen del parque tractivo">
    <div className={`fleet-summary-coverage ${counts.balance < 0 ? 'has-shortfall' : ''}`}>
      <div className="fleet-big-number"><strong>{number(counts.operativa)}</strong><span>/ {counts.required}</span></div>
      <span className="fleet-summary-label">Operativas / necesarias</span>
      <small>15 formaciones + 1 de respaldo</small>
      {!loading && <b>{counts.balance < 0 ? `Faltan ${-counts.balance} para cubrir la necesidad` : counts.balance === 0 ? 'Necesidad cubierta' : `Necesidad cubierta · +${counts.balance}`}</b>}
      <div className="fleet-capacity-bar" role="progressbar" aria-label="Cobertura del servicio" aria-valuemin={0} aria-valuemax={counts.required} aria-valuenow={Math.min(counts.operativa, counts.required)} aria-valuetext={`${counts.operativa} operativas de ${counts.required} necesarias`}><i style={{ width: `${counts.coverage}%` }} /></div>
    </div>
    <div className="fleet-summary-count detained"><strong>{number(counts.detenida)}</strong><span>Detenidas</span></div>
    <div className="fleet-summary-count exceptional"><strong>{number(counts.uso_excepcional)}</strong><span>Uso excepcional</span></div>
    <div className="fleet-summary-count"><strong>{number(counts.reserva)}</strong><span>Reserva</span></div>
    <div className="fleet-summary-count"><strong>{number(counts.total)}</strong><span>Total</span></div>
  </div>;
}
