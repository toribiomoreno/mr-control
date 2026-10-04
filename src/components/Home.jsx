import FleetOverview from './FleetOverview.jsx';
import FleetMetrics from './FleetMetrics.jsx';
import heroLocomotive from '../assets/home/home-hero-loc.jpeg';
import frontLocomotive from '../assets/home/locdetrompa.png';
import motionLocomotive from '../assets/home/home-motion-loc.jpeg';
import coaches from '../assets/home/remolcado-reference.webp';

export default function Home(props) {
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

      <section className="home-modules" aria-label="Material rodante">
        <details className="fleet-accordion fleet-accordion-tractive" open><summary><img className="fleet-summary-photo" src={heroLocomotive} alt="" /><span>Tractivo<small>Parque de locomotoras</small></span><FleetMetrics locomotoras={props.locomotoras} loading={props.loading} /></summary><FleetOverview {...props} /></details>
        <details className="fleet-accordion fleet-accordion-coaches"><summary><img className="fleet-summary-photo" src={coaches} alt="" /><span>Remolcado<small>Parque de coches</small></span></summary><div className="fleet-placeholder">Módulo pendiente de incorporación.</div></details>
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
