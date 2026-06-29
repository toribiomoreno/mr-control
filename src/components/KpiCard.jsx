export default function KpiCard({ label, tone = 'neutral', value }) {
  return (
    <article className={`history-kpi-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
