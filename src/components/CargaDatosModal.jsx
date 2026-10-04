import { useState } from 'react';
import { historyDates } from '../domain/maintenance/history.js';
import { evidenceQuestions } from '../domain/maintenance/view.js';
import { toRegister } from '../domain/maintenance/adapter.js';
import { completionQuestions, maintenanceEfficiency } from '../domain/maintenance/presentation.js';
import { dateLabel } from '../domain/maintenance/types.js';

export default function CargaDatosModal({ events, unit, onClose, onNew, onUpdate, onReview }) {
  const [code, setCode] = useState(unit || '');
  const [eventId, setEventId] = useState('');
  const [updateId, setUpdateId] = useState('');
  const jobs = events.filter(e => e.origen !== 'vista-previa-privada' && e.estadoMantenimiento !== 'cancelado');
  const selected = jobs.find(e => e.id === eventId);
  const register = selected ? toRegister([selected]) : null;
  const questions = selected ? [...evidenceQuestions(selected).map(q => q.text), ...completionQuestions(register, register.maintenances[0]).map(q => q.question)] : [];
  if (selected) questions.push(...maintenanceEfficiency(register, register.maintenances[0]).rows.filter(row => row.state === 'unknown').map(row => `¿Qué ocurrió el ${dateLabel(row.date)}? Confirmá trabajo o espera, turno, personal y duración.`));
  return <div className="modal-backdrop"><section className="intervention-modal" role="dialog" aria-modal="true" aria-label="Cargar datos">
    <div className="modal-heading"><div><span className="panel-kicker">Archivo histórico y mantenimientos</span><h2>Cargar datos</h2></div><button className="modal-close" aria-label="Cerrar carga" onClick={onClose}>×</button></div>
    <p>Si la intervención ya existe, agregá el avance a ese mantenimiento. Podés escribir o dictar en los mismos formularios.</p>
    <label>Filtrar locomotora<select value={code} onChange={e => { setCode(e.target.value); setEventId(''); setUpdateId(''); }}><option value="">Todas</option>{[...new Set(jobs.map(e => e.locomotoraCodigo))].sort().map(c => <option key={c}>{c}</option>)}</select></label>
    <label>Mantenimiento existente<select value={eventId} onChange={e => { setEventId(e.target.value); setUpdateId(''); }}><option value="">Elegir mantenimiento</option>{jobs.filter(e => !code || e.locomotoraCodigo === code).sort((a,b) => b.fecha.localeCompare(a.fecha)).map(e => <option key={e.id} value={e.id}>{e.locomotoraCodigo} · {e.titulo} · {historyDates(e)} · {e.estadoMantenimiento === 'finalizado' ? 'Finalizado' : 'Abierto'}</option>)}</select></label>
    {selected && <>
      {questions.length > 0 && <section className="history-modal-note" aria-label="Información por completar"><strong>Para completar este mantenimiento:</strong><ul>{[...new Set(questions)].map((question, index) => <li key={index}>{question}</li>)}</ul><p>Completá el ingreso en el detalle del mantenimiento; el trabajo, personal, turno y duración se registran en los avances.</p></section>}
      {onReview && <button className="secondary-action" onClick={() => onReview(selected.id)}>Revisar los datos del ingreso</button>}
      <label>Qué querés registrar<select value={updateId} onChange={e => setUpdateId(e.target.value)}><option value="">{selected.estadoMantenimiento === 'finalizado' ? 'Agregar observación al mantenimiento cerrado' : 'Nuevo avance, pausa o cierre'}</option>{(selected.actualizaciones || []).map(a => <option key={a.id} value={a.id}>Corregir {a.fecha}: {a.descripcion.slice(0, 80)}</option>)}</select></label>
      <button className="primary-action" onClick={() => onUpdate(selected.id, selected.actualizaciones?.find(a => a.id === updateId))}>Continuar con este mantenimiento</button>
    </>}
    <hr />
    <p>Para una intervención distinta, un lavado o una novedad de alistamiento:</p>
    <button className="secondary-action" onClick={onNew}>Crear un registro nuevo</button>
  </section></div>;
}
