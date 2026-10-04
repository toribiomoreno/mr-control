import SeguimientoFields from './SeguimientoFields.jsx';
import { today, wholeLocomotive } from '../domain/maintenance/types.js';
import { operationalOutcomes, outcomeLabels } from '../domain/maintenance/view.js';
import { validateEvent } from '../domain/maintenance/adapter.js';
import { lightSchedule } from '../domain/maintenance/schedule.js';
import { useState } from 'react';
import VoiceTextarea from './VoiceTextarea.jsx';

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
const correctiveSpecialties = ['Mecanica', 'Electrica', 'Neumatica', 'Carpintería', 'Sistemas de seguridad', 'Equipos de a bordo', 'Otra'];


function eventTitle(tipo, form) {
  if (tipo === 'preventivo') return `Preventivo ${form.get('preventivoCodigo')}`;
  if (tipo === 'correctivo') return String(form.get('titulo') || '').trim();
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
    return String(form.get('preventivoCodigo')).startsWith('Numeral') ? form.get('responsable') : 'Turno rotativo';
  }

  if (tipo === 'alistamiento') return 'Turno rotativo';
  if (tipo === 'lavado') return 'Sector lavadero';
  return form.get('responsable');
}

function isMaintenanceType(tipo) {
  return ['preventivo', 'correctivo'].includes(tipo);
}

export default function RegistroEventoModal({ locomotoras, selectedLoco, initialDate = '', onClose, onSave }) {
  const [tipo, setTipo] = useState('');
  const [preventivoCodigo, setPreventivoCodigo] = useState('E');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [outcome, setOutcome] = useState('');

  const preventiveResponsible = String(preventivoCodigo).startsWith('Numeral') ? 'Turno fijo' : 'Turno rotativo';

  // Mapea los campos visibles al objeto de evento que consume App.jsx.
  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentType = form.get('tipo');
    const fecha = form.get('fecha');
    const hora = String(form.get('hora') || '').slice(0, 5);
    const estadoMantenimiento = isMaintenanceType(currentType) ? (operationalOutcomes.includes(outcome) ? 'finalizado' : 'en_curso') : null;
    const fechaCierre = estadoMantenimiento === 'finalizado' ? form.get('fechaCierre') : null;
    const adjuntos = form.getAll('adjuntos').filter((file) => file && file.name);
    setErrorMessage('');

    if (hora && !isValidTimeValue(hora)) {
      setErrorMessage('La hora debe tener formato HH:mm.');
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        locomotoraCodigo: form.get('locomotoraCodigo'),
        fecha,
        hora: hora || null,
        tipo: currentType,
        preventivoCodigo: currentType === 'preventivo' ? form.get('preventivoCodigo') : null,
        especialidad: eventSpecialty(currentType, form),
        titulo: eventTitle(currentType, form),
        descripcion: form.get('descripcion'),
        responsable: eventResponsible(currentType, form),
        metadata: isMaintenanceType(currentType) ? { seguimiento: {
          captureVersion: 4,
          outcomeConfirmed: form.get('confirmAvailability') === 'on',
          detentionTime: form.get('detentionTime') || '',
          plannedStart: form.get('plannedStart') || '', plannedStartTime: form.get('plannedStartTime') || '',
          plannedEnd: form.get('plannedEnd') || '', plannedEndTime: form.get('plannedEndTime') || '',
          subsystem: form.get('subsystem') || '',
          detentionStart: form.get('detentionStart'), location: 'Boulogne',
          detentionReason: currentType === 'preventivo' ? 'Preventivo programado' : form.get('detentionReason'),
          outcome,
          ...(fechaCierre ? { availableDate: fechaCierre } : {}),
          system: currentType === 'preventivo' ? wholeLocomotive.system : form.get('system'),
          component: currentType === 'preventivo' ? wholeLocomotive.component : form.get('component') || form.get('subsystem'),
        } } : {},
        origen: 'manual',
        automatico: false,
        tags: currentType === 'alistamiento' ? ['alistamiento-con-novedad'] : [],
        criticidad: form.get('criticidad'),
        estadoMantenimiento,
        estadoUnidadResultante: outcome === 'operativa' ? 'servicio' : ['prueba', 'operativa_prueba'].includes(outcome) ? 'pendiente_de_prueba' : outcome === 'acompanada' ? 'disponible_con_observaciones' : null,
        fechaCierre,
        horaCierre: null,
      };
      const schedule = lightSchedule(payload);
      if (schedule) Object.assign(payload.metadata.seguimiento, { plannedStart: schedule.start, plannedStartTime: schedule.startTime, plannedEnd: schedule.end, plannedEndTime: schedule.endTime });
      validateEvent(payload);
      await onSave(payload, adjuntos);
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible guardar el evento.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="intervention-modal history-event-modal" onSubmit={handleSubmit} onInvalidCapture={(event) => setErrorMessage(`Falta completar: ${event.target.closest('label')?.firstChild?.textContent?.trim() || event.target.getAttribute('aria-label') || 'un dato obligatorio'}.`)}>
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
          <input name="fecha" type="date" defaultValue={initialDate || today()} max={today()} required />
        </label>

        <TimeSelect required={false} label="Hora de ingreso (si se conoce)" />

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
              {preventivoCodigo.startsWith('Numeral') ? <select name="responsable" defaultValue="" required><option value="">Confirmar personal</option><option>Turno fijo</option><option>Turno rotativo</option><option>Otro sector</option><option>Personal externo</option></select> : <input name="responsableVista" readOnly value={preventiveResponsible} />}
            </label>
            <label>
              Descripcion / novedad
              <VoiceTextarea
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
            <label>Trabajo o intervención (título breve)<input name="titulo" placeholder="Ej.: Cambio de compresor" required maxLength={160} /></label>
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
                <option>Otro sector</option>
                <option>Personal externo</option>
              </select>
            </label>
            <label>
              Descripcion / novedad
              <VoiceTextarea
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
              <VoiceTextarea
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
              <VoiceTextarea
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

        {isMaintenanceType(tipo) && <SeguimientoFields tipo={tipo} code={preventivoCodigo} />}
        {isMaintenanceType(tipo) && <label>¿Cómo queda la máquina después de este registro?
          <select name="outcome" value={outcome} onChange={e => setOutcome(e.target.value)} required><option value="">Confirmar estado</option>{Object.entries(outcomeLabels).filter(([key]) => key !== 'pendiente').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        </label>}
        {isMaintenanceType(tipo) && operationalOutcomes.includes(outcome) && <label className="tracking-confirm availability-confirm"><input name="confirmAvailability" type="checkbox" required />Confirmo el estado seleccionado y la disponibilidad de esta locomotora.</label>}
        {isMaintenanceType(tipo) && operationalOutcomes.includes(outcome) && <label>Fecha en que quedó operativa<input name="fechaCierre" type="date" max={today()} required /></label>}
        {isMaintenanceType(tipo) && <p className="tracking-hint">Primero guardamos el ingreso. A continuación vas a confirmar la actividad del día, el personal y las posibles demoras. El ingreso por sí solo no cuenta como un día trabajado.</p>}
        <label className="tracking-confirm"><input type="checkbox" required /> Confirmo la locomotora, fechas, tipo y responsable que estoy cargando.</label>
        <div className="history-file-drop">
          <strong>Anadir archivo</strong>
          <span>Arrastre archivos aca o examine su PC para adjuntar PDF, fotos, OT o informes.</span>
          <input name="adjuntos" type="file" accept="application/pdf,image/*" multiple />
        </div>

        <p className="tracking-hint">Completá cada dato obligatorio. Si falta alguno, el formulario te indicará cuál antes de guardar. Revisá el texto dictado.</p>

        <div className="modal-actions">
          <button className="secondary-action" onClick={onClose} type="button">Cancelar</button>
          <button className="primary-action" disabled={isSaving} type="submit">
            {isSaving ? 'Guardando...' : 'Guardar evento'}
          </button>
        </div>

        {errorMessage && (
          <div className="history-modal-note" role="alert">
            {errorMessage}
          </div>
        )}
      </form>
    </div>
  );
}
