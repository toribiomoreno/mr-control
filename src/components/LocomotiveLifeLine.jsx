import { buildLifeLine } from '../domain/maintenance/lifeLine.js';
import { dateLabel } from '../domain/maintenance/types.js';
import './locomotive-life-line.css';

export default function LocomotiveLifeLine({ events, loading, onOpenMaintenance }) {
  const { days, maintenance, operation, hasUnconfirmedDays } = buildLifeLine(events);
  return <section className="life-card" aria-label="Línea de vida de las últimas dos semanas">
    <div className="life-heading"><div><p className="eyebrow">Últimas dos semanas</p><h3>Línea de vida de la locomotora</h3></div><span>{dateLabel(days[0])} — {dateLabel(days.at(-1))}</span></div>
    <div className="life-legend"><span><i className="life-green" /> Operativa confirmada</span><span><i className="life-red" /> Correctivo</span><span><i className="life-yellow" /> Preventivo</span><span><i className="life-unknown" /> Sin estado confirmado</span></div>
    <div className="life-scroll"><div className="life-chart">
      <div className="life-days">{days.map((day) => <span key={day}>{day.slice(8)}/{day.slice(5, 7)}</span>)}</div>
      <div className="life-upper">{operation.map((item, index) => <div key={item.id} className="life-operation" style={{ gridColumn: `${item.column} / span ${item.span}`, gridRow: index + 1 }} title={item.reason}>{item.label}</div>)}</div>
      <div className="life-axis" aria-hidden="true" />
      <div className="life-lower">{maintenance.map((item, index) => <button key={item.id} type="button" className={`life-intervention ${item.kind}`} style={{ gridColumn: `${item.column} / span ${item.span}`, gridRow: index + 1 }} title={`${item.label}: ${item.reason}`} onClick={() => onOpenMaintenance(item.id)}><strong>{item.label}</strong><small>{item.reason}</small></button>)}</div>
    </div></div>
    {loading ? <p className="life-caption">Cargando estados…</p> : maintenance.length === 0 && operation.length === 0 ? <p className="life-caption">No hay estados confirmados para este período.</p> : hasUnconfirmedDays && <p className="life-caption">Los espacios sin barra aún no tienen estado confirmado. Tocá un mantenimiento para ver el detalle diario.</p>}
  </section>;
}
