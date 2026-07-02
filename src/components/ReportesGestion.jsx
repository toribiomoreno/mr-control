import heroImage from '../assets/home/home-motion-loc.jpeg';
import {
  campaignReportMock,
  evolutionReportMock,
  indicatorsReportMock,
  preventiveReportMock,
  reportFiltersMock,
  reportLastUpdateMock,
  reportModuleTabs,
  reportTaskRowsMock,
} from '../data/reportesMock.js';
import MaterialIcon from './MaterialIcon.jsx';
import MaterialModuleTabs from './MaterialModuleTabs.jsx';

function donutGradient(segments) {
  let cursor = 0;
  const parts = segments.map((segment) => {
    const start = cursor;
    cursor += segment.value;
    return `${segment.color} ${start}% ${cursor}%`;
  });

  return `conic-gradient(${parts.join(', ')})`;
}

function DonutChart({ label, segments, value }) {
  return (
    <div className="report-donut" style={{ background: donutGradient(segments) }}>
      <span>{value}</span>
      <small>{label}</small>
    </div>
  );
}

function EvolutionChart({ series }) {
  const width = 380;
  const height = 230;
  const padding = 36;
  const maxValue = 100;
  const stepX = (width - padding * 2) / (series.length - 1);
  const baseY = height - padding;
  const points = series.map((point, index) => {
    const x = padding + index * stepX;
    const y = baseY - (point.value / maxValue) * (height - padding * 2);
    return { ...point, x, y };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `${padding},${baseY} ${polyline} ${width - padding},${baseY}`;

  return (
    <div className="report-line-chart">
      <svg role="img" viewBox={`0 0 ${width} ${height}`}>
        <title>Evolucion mock de cumplimiento preventivo</title>
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = baseY - (tick / maxValue) * (height - padding * 2);
          return (
            <g key={tick}>
              <line className="chart-grid-line" x1={padding} x2={width - padding} y1={y} y2={y} />
              <text className="chart-axis-label" x={8} y={y + 4}>{tick}%</text>
            </g>
          );
        })}
        <polygon className="chart-area" points={area} />
        <polyline className="chart-line" points={polyline} />
        {points.map((point) => (
          <g key={point.label}>
            <circle className="chart-point" cx={point.x} cy={point.y} r="5" />
            <text className="chart-value-label" x={point.x - 10} y={point.y - 12}>{point.value}%</text>
            <text className="chart-axis-label" x={point.x - 10} y={height - 8}>{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function ReportesGestion({ onNavigate }) {
  return (
    <main className="material-view reportes-view">
      <section className="material-hero report-hero" aria-labelledby="reportes-title">
        <img alt="" className="material-hero-photo" src={heroImage} />
        <div className="material-hero-copy">
          <h1 id="reportes-title">Reportes de Gestion</h1>
          <p>Seguimiento operativo y cumplimiento del mantenimiento.</p>
          <span className="material-status-badge">Datos mock</span>
        </div>

        <div className="report-module-selector" aria-label="Modulos visuales de reportes">
          {reportModuleTabs.map((tab, index) => (
            <button className={index === 0 ? 'active' : ''} disabled key={tab.id} type="button">
              <MaterialIcon name={tab.icon} />
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="material-nav-strip" aria-label="Navegacion de reportes">
        <MaterialModuleTabs active="reportes" onNavigate={onNavigate} />
      </section>

      <section className="report-workspace">
        <form className="report-filter-bar" onSubmit={(event) => event.preventDefault()}>
          <label>
            Desde
            <input defaultValue={reportFiltersMock.from} type="date" />
          </label>
          <label>
            Hasta
            <input defaultValue={reportFiltersMock.to} type="date" />
          </label>
          <label>
            Tipo
            <select defaultValue={reportFiltersMock.tipo}>
              <option>Todos</option>
              <option>Preventivo</option>
              <option>Campana</option>
              <option>Calidad</option>
            </select>
          </label>
          <label>
            Area
            <select defaultValue={reportFiltersMock.area}>
              <option>Todas</option>
              <option>Ingenieria</option>
              <option>Calidad</option>
            </select>
          </label>
          <label>
            Unidad
            <select defaultValue={reportFiltersMock.unidad}>
              <option>Todas</option>
              <option>Locomotoras</option>
              <option>Coches</option>
            </select>
          </label>
          <button className="report-export-button" disabled type="button">
            <MaterialIcon name="download" />
            Exportar
          </button>
        </form>

        <section className="report-card-grid" aria-label="Tarjetas visuales de reportes">
          <article className="report-card campaign-card">
            <header>
              <MaterialIcon name="target" />
              <h2>{campaignReportMock.title}</h2>
            </header>
            <p>{campaignReportMock.subtitle}</p>
            <strong className="report-main-value">{campaignReportMock.value}</strong>
            <div className="report-progress-track">
              <span style={{ width: campaignReportMock.value }} />
            </div>
            <div className="campaign-metric-row">
              {campaignReportMock.metrics.map((metric) => (
                <span key={metric.label}>
                  {metric.label}
                  <strong>{metric.value}</strong>
                </span>
              ))}
            </div>
            <div className="report-donut-row">
              <DonutChart label="Visual" segments={campaignReportMock.donut} value="Mock" />
              <div className="report-legend">
                {campaignReportMock.donut.map((item) => (
                  <span key={item.label}>
                    <b style={{ background: item.color }} />
                    {item.label}
                    <strong>{item.value}%</strong>
                  </span>
                ))}
              </div>
            </div>
            <button className="report-detail-button" disabled type="button">
              {campaignReportMock.detailLabel}
              <MaterialIcon name="arrow-right" />
            </button>
          </article>

          <article className="report-card preventive-card">
            <header>
              <MaterialIcon name="calendar" />
              <h2>{preventiveReportMock.title}</h2>
            </header>
            <p>{preventiveReportMock.subtitle}</p>
            <div className="preventive-chart-row">
              <DonutChart label="Cumplimiento" segments={preventiveReportMock.donut} value={preventiveReportMock.value} />
              <div className="preventive-totals">
                {preventiveReportMock.legend.map((item) => (
                  <span key={item.label}>
                    {item.label}
                    <strong>{item.value}</strong>
                  </span>
                ))}
              </div>
            </div>
            <div className="report-legend compact">
              {preventiveReportMock.donut.map((item) => (
                <span key={item.label}>
                  <b style={{ background: item.color }} />
                  {item.label}
                  <strong>{item.value}%</strong>
                </span>
              ))}
            </div>
            <button className="report-detail-button" disabled type="button">
              {preventiveReportMock.detailLabel}
              <MaterialIcon name="arrow-right" />
            </button>
          </article>

          <article className="report-card evolution-card">
            <header>
              <MaterialIcon name="trend" />
              <h2>{evolutionReportMock.title}</h2>
            </header>
            <p>{evolutionReportMock.subtitle}</p>
            <EvolutionChart series={evolutionReportMock.series} />
            <button className="report-detail-button" disabled type="button">
              {evolutionReportMock.detailLabel}
              <MaterialIcon name="arrow-right" />
            </button>
          </article>

          <article className="report-card indicators-card">
            <header>
              <MaterialIcon name="reports" />
              <h2>{indicatorsReportMock.title}</h2>
            </header>
            <div className="indicator-card-grid">
              {indicatorsReportMock.cards.map((card) => (
                <article className="indicator-mini-card" key={card.label}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small className={card.tone}>{card.delta} vs. mock</small>
                </article>
              ))}
            </div>
            <div className="report-bars">
              {indicatorsReportMock.bars.map((bar) => (
                <span key={bar.label}>
                  <b style={{ height: `${bar.value}%` }} />
                  <em>{bar.label}</em>
                </span>
              ))}
            </div>
            <button className="report-detail-button" disabled type="button">
              {indicatorsReportMock.detailLabel}
              <MaterialIcon name="arrow-right" />
            </button>
          </article>
        </section>

        <section className="report-table-card" aria-label="Listado visual de campanas y tareas">
          <header>
            <div>
              <span className="panel-kicker">Listado mock</span>
              <h2>Campanas y tareas</h2>
            </div>
            <span className="material-status-badge">Sin Supabase</span>
          </header>
          <div className="report-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tarea</th>
                  <th>Area</th>
                  <th>Unidad</th>
                  <th>Periodo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {reportTaskRowsMock.map((row) => (
                  <tr key={`${row.tarea}-${row.area}`}>
                    <td>{row.tarea}</td>
                    <td>{row.area}</td>
                    <td>{row.unidad}</td>
                    <td>{row.periodo}</td>
                    <td><span>{row.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="report-update-strip">
          <span>Los datos visuales se actualizan desde mocks centralizados.</span>
          <strong>Ultima actualizacion: {reportLastUpdateMock}</strong>
        </footer>
      </section>
    </main>
  );
}
