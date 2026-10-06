export default function MaintenanceBar({ bar, onSelect }) {
  const status = bar.event.estadoMantenimiento === 'finalizado' ? 'Finalizado' : 'En curso';
  return <button className={`tracking-bar ${bar.kind} ${bar.unconfirmed ? 'is-unconfirmed' : ''}`} style={{ gridColumn: `${bar.column} / span ${bar.span}`, gridRow: bar.lane + 1 }} onClick={() => onSelect(bar.id)} title={`${bar.label} · ${status} · ${bar.reason}`}><strong>{bar.label}</strong><span>{status}</span></button>;
}
