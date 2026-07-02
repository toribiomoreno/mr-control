import heroImage from '../assets/home/home-motion-loc.jpeg';
import { areaModules, areasSummaryCards } from '../data/areasMock.js';
import MaterialIcon from './MaterialIcon.jsx';
import MaterialModuleTabs from './MaterialModuleTabs.jsx';

export default function AreasMaterialRodante({ onNavigate }) {
  return (
    <main className="material-view areas-view">
      <section className="material-hero" aria-labelledby="areas-title">
        <img alt="" className="material-hero-photo" src={heroImage} />
        <div className="material-hero-copy">
          <h1 id="areas-title">Areas de Material Rodante</h1>
          <p>Gestion tecnica y seguimiento por sector.</p>
          <span className="material-hero-accent" />
        </div>
      </section>

      <section className="material-nav-strip" aria-label="Navegacion de areas">
        <MaterialModuleTabs active="areas" onNavigate={onNavigate} />
        <button className="material-primary-action" disabled type="button">
          <MaterialIcon name="plus" />
          Registrar intervencion
        </button>
      </section>

      <section className="areas-workspace">
        <div className="areas-summary-grid" aria-label="Estados visuales de areas">
          {areasSummaryCards.map((card) => (
            <article className="areas-summary-card" key={card.id}>
              <span className="areas-summary-icon">
                <MaterialIcon name={card.icon} />
              </span>
              <div>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.note}</small>
              </div>
            </article>
          ))}
        </div>

        <div className="area-departments-grid">
          {areaModules.map((module) => (
            <article className={`area-module-card ${module.id}`} key={module.id}>
              <header>
                <span className="area-module-icon">
                  <MaterialIcon name={module.icon} />
                </span>
                <div>
                  <h2>{module.title}</h2>
                  <p>{module.description}</p>
                </div>
                <MaterialIcon className="area-card-chevron" name="chevron-right" />
              </header>

              <div className="area-module-items">
                {module.items.map((item) => (
                  <button className="area-module-item" disabled key={item.title} type="button">
                    <MaterialIcon name={item.icon} />
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </button>
                ))}
              </div>

              <button className="area-link-button" disabled type="button">
                {module.actionLabel}
                <MaterialIcon name="arrow-right" />
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
