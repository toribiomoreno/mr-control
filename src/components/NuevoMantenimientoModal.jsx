import { useState } from 'react';
import ActualizacionEventoModal from './ActualizacionEventoModal.jsx';
import MaintenanceIntakeFields from './MaintenanceIntakeFields.jsx';
import { today } from '../domain/maintenance/types.js';

export default function NuevoMantenimientoModal({ locomotoras, unit, initialDate, embedded = false, onClose, onCreate, onSaveProgress, onCreated }) {
  const [draft, setDraft] = useState({ locomotoraCodigo: unit || locomotoras[0]?.codigo, tipo: 'correctivo', preventivoCodigo: null, fecha: initialDate || today(), estadoMantenimiento: 'en_curso', metadata: { seguimiento: { detentionReason: '' } }, actualizaciones: [] });
  const [saved, setSaved] = useState(null);
  async function save(parent, progress, files) {
    const event = saved || await onCreate(parent, files);
    setSaved(event);
    try { await onSaveProgress(event, { ...progress, eventoId: event.id }, []); }
    catch (error) { throw new Error(`El ingreso quedó guardado. No se pudo completar el avance. ${error.message}`, { cause: error }); }
    await onCreated(event);
  }
  return <ActualizacionEventoModal event={saved || draft} initialDate={initialDate} creatingMaintenance embedded={embedded} onClose={onClose} onSave={save}
    intakeFields={setWorkDate => <><MaintenanceIntakeFields event={saved || draft} locomotoras={locomotoras} legend="Datos del mantenimiento" disabled={Boolean(saved)} onTypeChange={type => setDraft(current => ({ ...current, tipo: type === 'Correctivo' ? 'correctivo' : 'preventivo', preventivoCodigo: type === 'Correctivo' ? null : type }))} onStartDateChange={date => { setDraft(current => ({ ...current, fecha: date })); setWorkDate(date); }} />{saved && <p className="tracking-hint">Ingreso guardado. Completá o reintentá el avance en esta misma ficha.</p>}</>} />;
}
