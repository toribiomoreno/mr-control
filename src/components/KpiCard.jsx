export default function KpiCard({ icon = 'I', label, tone = 'neutral', value }) {
  return (
    <article className={`history-kpi-card ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <em aria-hidden="true">{icon}</em>
    </article>
  );
}
