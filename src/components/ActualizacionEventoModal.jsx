import { useState } from 'react';

import TimeSelect from './TimeSelect.jsx';
import { isValidTimeValue } from './timeUtils.js';

const updateTypes = [
  { value: 'avance', label: 'Avance' },
  { value: 'pausa', label: 'Pausa' },
  { value: 'observacion', label: 'Observacion' },
  { value: 'reanudacion', label: 'Reanudacion' },
  { value: 'cierre', label: 'Cierre' },
];

const responsibleOptions = ['Turno fijo', 'Turno rotativo'];

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentTimeValue() {
  return new Date().toTimeString().slice(0, 5);
}

function defaultStateForType(type) {
  if (type === 'pausa') return 'pausado';
  if (type === 'cierre') return 'finalizado';
  if (type === 'reanudacion' || type === 'avance') return 'en_curso';
  return null;
}

export default function ActualizacionEventoModal({
  event,
  mode = 'avance',
  onClose,
  onSave,
}) {
  const isObservationOnly = mode === 'observacion';
  const initialType = isObservationOnly ? 'observacion' : 'avance';
  const [tipo, setTipo] = useState(initialType);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isPause = tipo === 'pausa';
  const descriptionLabel = isPause ? 'Motivo de la pausa' : isObservationOnly ? 'Observacion' : 'Descripcion';

  const handleSubmit = async (submitEvent) => {
    submitEvent.preventDefault();
    const form = new FormData(submitEvent.currentTarget);
    const descriptionValue = String(form.get(isPause ? 'motivoPausa' : 'descripcion') || '').trim();
    const responsable = String(form.get('responsable') || '').trim();
    const hora = String(form.get('hora') || '').slice(0, 5);

    setErrorMessage('');

    if (!isValidTimeValue(hora)) {
      setErrorMessage('La hora debe tener formato HH:mm.');
      return;
    }

    const payload = {
      eventoId: event.id,
      fecha: form.get('fecha'),
      hora,
      tipoActualizacion: tipo,
      descripcion: descriptionValue,
      responsable,
      porcentajeAvance: null,
      estadoResultante: defaultStateForType(tipo),
      motivoPausa: isPause ? descriptionValue : null,
      motivoReapertura: null,
      resultadoPrueba: null,
      estadoUnidadResultante: null,
      pendientes: null,
    };
    const files = form.getAll('adjuntos').filter((file) => file && file.name);

    setIsSaving(true);

    try {
      await onSave(event, payload, files);
      onClose();
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible guardar el avance.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="intervention-modal maintenance-update-modal" onSubmit={handleSubmit}>
        <div className="modal-heading">
          <div>
            <span className="panel-kicker">{event.titulo || 'Mantenimiento'}</span>
            <h2>{isObservationOnly ? 'Agregar observacion' : 'Registrar avance'}</h2>
          </div>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Cerrar">x</button>
        </div>

        {!isObservationOnly && (
          <label>
            Tipo de actualizacion
            <select name="tipoActualizacion" onChange={(item) => setTipo(item.target.value)} value={tipo} required>
              {updateTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        )}

        <label>
          Fecha
          <input name="fecha" type="date" defaultValue={todayInputValue()} required />
        </label>

        <TimeSelect defaultValue={currentTimeValue()} />

        <label>
          Responsable
          <select name="responsable" defaultValue="" required>
            <option value="" disabled>Seleccionar turno</option>
            {responsibleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>

        <label>
          {descriptionLabel}
          <textarea name={isPause ? 'motivoPausa' : 'descripcion'} rows="4" required />
        </label>

        <div className="history-file-drop">
          <strong>Adjuntos</strong>
          <span>Adjunte PDF, fotos, OT o informes asociados al avance.</span>
          <input name="adjuntos" type="file" accept="application/pdf,image/*" multiple />
        </div>

        <div className="modal-actions">
          <button className="secondary-action" onClick={onClose} type="button">Cancelar</button>
          <button className="primary-action" disabled={isSaving} type="submit">
            {isSaving ? 'Guardando...' : isObservationOnly ? 'Guardar observacion' : 'Guardar avance'}
          </button>
        </div>

        {errorMessage && (
          <div className="history-modal-note">
            {errorMessage}
          </div>
        )}
      </form>
    </div>
  );
}
