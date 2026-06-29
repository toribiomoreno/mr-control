import { useState } from 'react';

import TimeSelect from './TimeSelect.jsx';
import { isValidTimeValue } from './timeUtils.js';

const numeralOptions = [
  'Numeral 1',
  'Numeral 2',
  'Numeral 3',
  'Numeral 4',
  'Numeral 5',
  'Numeral 6',
  'Numeral 7',
  'Numeral 8',
  'Numeral 9',
  'Numeral 10',
  'Numeral 11',
  'Numeral 12',
];

const preventiveOptions = ['E', 'A', 'AB', 'ABC', ...numeralOptions];
const correctiveSpecialties = ['Mecanica', 'Electrica', 'Neumatica', 'Sistemas de seguridad', 'Otra'];

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

function eventTitle(tipo, form) {
  if (tipo === 'preventivo') return `Preventivo ${form.get('preventivoCodigo')}`;
  if (tipo === 'correctivo') return `Correctivo ${form.get('especialidad')}`;
  if (tipo === 'alistamiento') return `Novedad de alistamiento ${form.get('especialidad')}`;
  if (tipo === 'lavado') return 'Lavado';
  return 'Evento';
}

function eventSpecialty(tipo, form) {
  if (tipo === 'preventivo') return 'Todas';
  if (tipo === 'alistamiento') return form.get('especialidad');
  if (tipo === 'lavado') return 'Lavado';
  return form.get('especialidad');
}

function eventResponsible(tipo, form) {
  if (tipo === 'preventivo') {
    return String(form.get('preventivoCodigo')).startsWith('Numeral') ? 'Turno fijo' : 'Turno rotativo';
  }

  if (tipo === 'alistamiento') return 'Turno rotativo';
  if (tipo === 'lavado') return 'Sector lavadero';
  return form.get('responsable');
}

function isMaintenanceType(tipo) {
  return ['preventivo', 'correctivo'].includes(tipo);
}

export default function RegistroEventoModal({ locomotoras, selectedLoco, onClose, onSave }) {
  const [tipo, setTipo] = useState('');
  const [preventivoCodigo, setPreventivoCodigo] = useState('E');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const preventiveResponsible = String(preventivoCodigo).startsWith('Numeral') ? 'Turno fijo' : 'Turno rotativo';

  // Mapea los campos visibles al objeto de evento que consume App.jsx.
  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentType = form.get('tipo');
    const fecha = form.get('fecha');
    const hora = String(form.get('hora') || '').slice(0, 5);
    const estadoMantenimiento = isMaintenanceType(currentType) ? form.get('estadoMantenimiento') : null;
    const adjuntos = form.getAll('adjuntos').filter((file) => file && file.name);
    setErrorMessage('');

    if (!isValidTimeValue(hora)) {
      setErrorMessage('La hora debe tener formato HH:mm.');
      return;
    }

    setIsSaving(true);

    try {
      await onSave({
        locomotoraCodigo: form.get('locomotoraCodigo'),
        fecha,
        hora,
        tipo: currentType,
        preventivoCodigo: currentType === 'preventivo' ? form.get('preventivoCodigo') : null,
        especialidad: eventSpecialty(currentType, form),
        titulo: eventTitle(currentType, form),
        descripcion: form.get('descripcion'),
        responsable: eventResponsible(currentType, form),
        origen: 'manual',
        automatico: false,
        tags: currentType === 'alistamiento' ? ['alistamiento-con-novedad'] : [],
        criticidad: form.get('criticidad'),
        estadoMantenimiento,
        fechaCierre: estadoMantenimiento === 'finalizado' ? fecha : null,
        horaCierre: estadoMantenimiento === 'finalizado' ? hora : null,
      }, adjuntos);
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible guardar el evento.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="intervention-modal history-event-modal" onSubmit={handleSubmit}>
        <div className="modal-heading">
          <div>
            <span className="panel-kicker">Carga de datos</span>
            <h2>Registrar evento</h2>
          </div>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Cerrar">x</button>
        </div>

        <label>
          Locomotora
          <select name="locomotoraCodigo" defaultValue={selectedLoco.codigo} required>
            {locomotoras.map((item) => <option key={item.codigo} value={item.codigo}>{item.codigo}</option>)}
          </select>
        </label>

        <label>
          Fecha
          <input name="fecha" type="date" defaultValue={todayInputValue()} required />
        </label>

        <TimeSelect defaultValue={currentTimeValue()} />

        <label>
          Tipo de evento
          <select name="tipo" onChange={(event) => setTipo(event.target.value)} value={tipo} required>
            <option value="" disabled>Seleccionar tipo de evento</option>
            <option value="preventivo">Preventivo</option>
            <option value="correctivo">Correctivo</option>
            <option value="alistamiento">Novedad de alistamiento</option>
            <option value="lavado">Lavado</option>
          </select>
        </label>

        {!tipo && (
          <div className="history-modal-note">
            Seleccione un tipo de evento para habilitar los campos de carga correspondientes.
          </div>
        )}

        {tipo === 'preventivo' && (
          <>
            <label>
              Tipo de preventivo
              <select name="preventivoCodigo" onChange={(event) => setPreventivoCodigo(event.target.value)} value={preventivoCodigo} required>
                {preventiveOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Responsable
              <input name="responsableVista" readOnly value={preventiveResponsible} />
            </label>
            <label>
              Estado del mantenimiento
              <select name="estadoMantenimiento" defaultValue="en_curso" required>
                <option value="en_curso">En curso</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </label>
            <label>
              Descripcion / novedad
              <textarea
                name="descripcion"
                rows="4"
                placeholder="Detalle del preventivo realizado..."
                required
              />
            </label>
          </>
        )}

        {tipo === 'correctivo' && (
          <>
            <label>
              Especialidad
              <select name="especialidad" defaultValue="" required>
                <option value="" disabled>Seleccionar especialidad</option>
                {correctiveSpecialties.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Quien lo ataco
              <select name="responsable" defaultValue="" required>
                <option value="" disabled>Seleccionar turno</option>
                <option>Turno fijo</option>
                <option>Turno rotativo</option>
              </select>
            </label>
            <label>
              Estado del mantenimiento
              <select name="estadoMantenimiento" defaultValue="en_curso" required>
                <option value="en_curso">En curso</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </label>
            <label>
              Descripcion / novedad
              <textarea
                name="descripcion"
                rows="4"
                placeholder="Detalle del correctivo realizado..."
                required
              />
            </label>
          </>
        )}

        {tipo === 'alistamiento' && (
          <>
            <label>
              Especialidad
              <select name="especialidad" defaultValue="" required>
                <option value="" disabled>Seleccionar especialidad</option>
                {correctiveSpecialties.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Responsable
              <input name="responsableVista" readOnly value="Turno rotativo" />
            </label>
            <label>
              Descripcion / novedad
              <textarea
                name="descripcion"
                rows="4"
                placeholder="Detalle de la novedad de alistamiento..."
                required
              />
            </label>
          </>
        )}

        {tipo === 'lavado' && (
          <>
            <label>
              Responsable
              <input name="responsableVista" readOnly value="Sector lavadero" />
            </label>
            <label>
              Descripcion / novedad
              <textarea
                name="descripcion"
                rows="4"
                placeholder="Detalle del lavado realizado..."
                required
              />
            </label>
          </>
        )}

        {tipo && (
          <fieldset className="history-criticality-options">
            <legend>Criticidad</legend>
            <label><input name="criticidad" type="radio" value="baja" defaultChecked /> Baja</label>
            <label><input name="criticidad" type="radio" value="alta" /> Alta</label>
          </fieldset>
        )}

        <div className="history-file-drop">
          <strong>Anadir archivo</strong>
          <span>Arrastre archivos aca o examine su PC para adjuntar PDF, fotos, OT o informes.</span>
          <input name="adjuntos" type="file" accept="application/pdf,image/*" multiple />
        </div>

        <div className="history-modal-note">
          El libro de novedades puede importarse desde Archivo Historico mientras no exista sincronizacion automatica real.
        </div>

        <div className="modal-actions">
          <button className="secondary-action" onClick={onClose} type="button">Cancelar</button>
          <button className="primary-action" disabled={isSaving} type="submit">
            {isSaving ? 'Guardando...' : 'Guardar evento'}
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
