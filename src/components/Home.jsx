import heroLocomotive from '../assets/home/home-hero-loc.jpeg';
import frontLocomotive from '../assets/home/locdetrompa.png';
import motionLocomotive from '../assets/home/home-motion-loc.jpeg';

const quickTabs = ['Locomotoras', 'Coches', 'Areas', 'Reportes'];

export default function Home() {
  return (
    <main className="home-dashboard">
      <section className="home-hero" aria-labelledby="home-title">
        <img className="home-hero-photo" src={motionLocomotive} alt="" />

        <div className="home-hero-copy">
          <h2 id="home-title">Material Rodante</h2>
          <p className="home-lead">Impulsando el mantenimiento y la operacion ferroviaria</p>
          <p>
            Aseguramos un transporte eficiente y seguro a traves de la gestion
            optima de locomotoras y coches.
          </p>
        </div>
      </section>

      <section className="home-command-bar" aria-label="Accesos principales">
        <div className="home-quick-tabs">
          {quickTabs.map((item, index) => (
            <button className={index === 0 ? 'active' : ''} key={item} type="button">
              <span className="tab-mark" />
              {item}
            </button>
          ))}
        </div>

        <div className="home-action-row">
          <div className="home-search" aria-hidden="true" />
          <button className="home-register-button" type="button">+ Registrar Intervencion</button>
        </div>
      </section>

      <section className="home-modules" aria-label="Modulos de material rodante">
        <div className="home-module-tabs">
          {quickTabs.map((item, index) => (
            <button className={index === 0 ? 'active' : ''} key={item} type="button">
              <span className="module-icon" />
              {item}
            </button>
          ))}
        </div>

        <div className="home-info-grid">
          <article className="home-info-card">
            <span className="home-card-icon target" />
            <h3>Mision</h3>
            <strong>Maximizar la fiabilidad y disponibilidad del material rodante</strong>
            <p>
              Garantizamos el optimo estado y funcionamiento de nuestros trenes,
              asegurando la seguridad y eficiencia en el transporte ferroviario.
            </p>
          </article>

          <article className="home-info-card">
            <span className="home-card-icon trophy" />
            <h3>Objetivos</h3>
            <p>Nuestras metas para el exito</p>
            <ul>
              <li>Reducir el tiempo fuera de servicio</li>
              <li>Optimizar el mantenimiento preventivo</li>
              <li>Prolongar la vida util de los equipos</li>
            </ul>
          </article>

          <article className="home-info-card home-scope-card">
            <span className="home-card-icon gear" />
            <h3>Alcance</h3>
            <strong>Gestion integral del material rodante</strong>
            <ul>
              <li>Mantenimiento de locomotoras y coches</li>
              <li>Gestion de repuestos y recursos</li>
              <li>Monitorizacion del estado y rendimiento</li>
              <li>Coordinacion con Infraestructura y Transporte</li>
            </ul>
          </article>

          <article className="home-metric-card">
            <span className="metric-flame" />
            <strong>+85%</strong>
            <p>Locomotoras operativas</p>
          </article>

          <article className="home-metric-card">
            <span className="metric-team" />
            <strong>+40</strong>
            <p>Tecnicos especializados</p>
          </article>
        </div>
      </section>

      <section className="home-route">
        <div>
          <h2>Eficiencia y Seguridad en Cada Ruta</h2>
          <p>Comprometidos con el servicio y la mejora tecnologica.</p>
        </div>

        <div className="home-locomotive-showcase">
          <figure className="home-motion-frame">
            <img src={heroLocomotive} alt="Locomotora E721 en taller ferroviario" />
          </figure>
          <figure className="home-motion-frame portrait">
            <img src={frontLocomotive} alt="Detalle lateral de locomotora G22 CU" />
          </figure>
          <article className="home-model-card">
            <span>Locomotora diesel-electrica</span>
            <h3>Locomotora G22 - CU</h3>
            <dl>
              <div><dt>Modelo</dt><dd>G22 CU</dd></div>
              <div><dt>Trocha</dt><dd>1000 mm</dd></div>
            </dl>
            <p>
              La familia G22-CU forma parte de las locomotoras diesel-electricas
              que se incorporaron a redes de trocha metrica por su equilibrio
              entre potencia, simplicidad mecanica y confiabilidad diaria. En
              servicio suburbano y regional, su valor estuvo en sostener ciclos
              intensivos de trabajo con mantenimiento accesible para taller.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
