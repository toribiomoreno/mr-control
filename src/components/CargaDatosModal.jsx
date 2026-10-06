export default function CargaDatosModal({ onClose, newMaintenance }) {
  return <div className="modal-backdrop"><section className="intervention-modal" role="dialog" aria-modal="true" aria-label="Cargar datos">
    <div className="modal-heading"><div><span className="panel-kicker">Archivo histórico y mantenimientos</span><h2>Cargar datos</h2></div><button className="modal-close" aria-label="Cerrar carga" onClick={onClose}>×</button></div>
    {newMaintenance}
  </section></div>;
}
