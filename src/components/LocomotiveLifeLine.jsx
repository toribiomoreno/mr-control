import { buildLifeLine } from '../domain/maintenance/lifeLine.js';
import { dateLabel } from '../domain/maintenance/types.js';
import './locomotive-life-line.css';

export default function LocomotiveLifeLine({ events, loading, onOpenMaintenance }) {
  const { days, maintenance, states, hasUnconfirmedDays } = buildLifeLine(events);
  return <section className="life-card" aria-label="Línea de vida de las últimas dos semanas">
    <div className="life-heading"><div><p className="eyebrow">Últimas dos semanas</p><h3>Línea de vida de la locomotora</h3></div><span>{dateLabel(days[0])} — {dateLabel(days.at(-1))}</span></div>
    <div className="life-legend"><span><i className="life-green" /> Operativa</span><span><i className="life-red" /> Detenida / correctivo</span><span><i className="life-blue" /> Reserva</span><span><i className="life-purple" /> Uso excepcional</span><span><i className="life-yellow" /> Preventivo</span><span><i className="life-unknown" /> Sin estado confirmado</span></div>
    <div className="life-scroll"><div className="life-chart">
      <div className="life-days">{days.map((day) => <span key={day}>{day.slice(8)}/{day.slice(5, 7)}</span>)}</div>
      <div className="life-upper">{states.map((item) => <div key={item.id} className={`life-operation ${item.kind}`} style={{ gridColumn: `${item.column} / span ${item.span}` }} title={item.reason}>{item.label}</div>)}</div>
      <div className="life-axis" aria-hidden="true" />
      <div className="life-lower">{maintenance.map((item) => <button key={item.id} type="button" className={`life-intervention ${item.kind} ${item.unconfirmed ? 'is-unconfirmed' : ''}`} style={{ gridColumn: `${item.column} / span ${item.span}`, gridRow: item.lane + 1 }} title={`${item.label}: ${item.reason}`} onClick={() => onOpenMaintenance(item.id)}><strong>{item.label}</strong><small>{item.reason}</small></button>)}</div>
    </div></div>
    {loading ? <p className="life-caption">Cargando estados…</p> : maintenance.length === 0 && states.length === 0 ? <p className="life-caption">No hay estados confirmados para este período.</p> : hasUnconfirmedDays && <p className="life-caption">Las barras punteadas indican mantenimientos abiertos cuya continuidad falta confirmar. Los espacios vacíos no tienen estado registrado.</p>}
  </section>;
}
