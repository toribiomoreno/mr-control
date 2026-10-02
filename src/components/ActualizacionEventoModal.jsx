import { causes, systems, today } from '../domain/maintenance/types.js';
import { isLight, validateUpdate } from '../domain/maintenance/adapter.js';
import { beforeMaintenanceClosure, operationalOutcomes, outcomeLabels } from '../domain/maintenance/view.js';
import { useState } from 'react';
import VoiceTextarea from './VoiceTextarea.jsx';

import TimeSelect from './TimeSelect.jsx';
import { isValidTimeValue } from './timeUtils.js';

const updateTypes = [
  { value: 'avance', label: 'Avance' },
  { value: 'pausa', label: 'Pausa' },
  { value: 'observacion', label: 'Observacion' },
  { value: 'reanudacion', label: 'Reanudacion' },
  { value: 'cierre', label: 'Cierre' },
];

const responsibleOptions = ['Turno fijo', 'Turno rotativo', 'Otro sector', 'Personal externo'];

function defaultStateForType(type) {
  if (type === 'pausa') return 'pausado';
  if (type === 'cierre') return 'finalizado';
  if (type === 'reanudacion' || type === 'avance') return 'en_curso';
  return null;
}

export default function ActualizacionEventoModal({
  event,
  mode = 'avance',
  initialUpdate = null,
  initialDate = '',
  newEntry = false,
  embedded = false,
  onClose,
  onSave,
}) {
  const isObservationOnly = mode === 'observacion';
  const initialType = initialUpdate?.tipoActualizacion || (isObservationOnly ? 'observacion' : 'avance');
  const [tipo, setTipo] = useState(initialType);
  const saved = initialUpdate?.metadata?.seguimiento || {};
  const [activity, setActivity] = useState(saved.activity || '');
  const [staff, setStaff] = useState(initialUpdate?.responsable || (isLight(event) ? 'Turno rotativo' : ''));
  const [fraction, setFraction] = useState(saved.usefulFraction == null ? '' : String(saved.usefulFraction));
  const [outcome, setOutcome] = useState(saved.outcome || '');
  const [date, setDate] = useState(initialUpdate?.fecha || initialDate || today());
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

    if (hora && !isValidTimeValue(hora)) {
      setErrorMessage('La hora debe tener formato HH:mm.');
      return;
    }

    const payload = {
      ...(initialUpdate?.id ? { id: initialUpdate.id, updatedAt: initialUpdate.updatedAt } : {}),
      eventoId: event.id,
      fecha: form.get('fecha'),
      hora: hora || null,
      tipoActualizacion: event.estadoMantenimiento !== 'finalizado' && operationalOutcomes.includes(outcome) ? 'cierre' : tipo,
      descripcion: descriptionValue,
      responsable,
      porcentajeAvance: null,
      estadoResultante: event.estadoMantenimiento !== 'finalizado' && operationalOutcomes.includes(outcome) ? 'finalizado' : defaultStateForType(tipo),
      motivoPausa: isPause ? descriptionValue : null,
      motivoReapertura: null,
      resultadoPrueba: initialUpdate?.resultadoPrueba || null,
      estadoUnidadResultante: outcome === 'operativa' ? 'servicio' : ['prueba', 'operativa_prueba'].includes(outcome) ? 'pendiente_de_prueba' : outcome === 'acompanada' ? 'disponible_con_observaciones' : ['continua', 'detenida'].includes(outcome) ? 'fuera_de_servicio' : initialUpdate?.estadoUnidadResultante || null,
      pendientes: initialUpdate?.pendientes || null,
      metadata: { ...initialUpdate?.metadata, seguimiento: {
        ...saved,
        usefulFraction: undefined,
        workDurationDays: undefined,
        captureVersion: 3,
        confirmedUnknownOutcome: outcome === 'pendiente' && form.get('confirmUnknownOutcome') === 'on',
        confirmedUnknownActivity: activity === 'sin_dato' && form.get('confirmActivity') === 'on',
        ...(outcome ? { outcome } : {}),
        activity, system: form.get('system') || event.metadata?.seguimiento?.system || '', component: form.get('component') || event.metadata?.seguimiento?.component || '', period: staff === 'Turno fijo' && ['trabajo', 'mixto'].includes(activity) ? 'Mañana' : form.get('period') || '',
        cause: ['espera', 'mixto'].includes(activity) ? form.get('cause') : '',
        dayComplete: date === today() && event.estadoMantenimiento !== 'finalizado' ? form.get('dayComplete') === 'on' : saved.dayComplete === true,
        fullDay: activity === 'espera' && form.get('fullDay') === 'on',
        weekendEligible: form.get('weekendEligible') === 'on',
        ...(fraction !== '' ? { usefulFraction: Number(fraction) } : {}),
        allocationNote: form.get('allocationNote') || '',
        ...(['trabajo', 'mixto'].includes(activity) ? { workDurationDays: isLight(event) || form.get('workDurationDays') === 'unknown' ? null : Number(form.get('workDurationDays')), confirmedUnknownDuration: form.get('workDurationDays') === 'unknown', staffSpecialty: form.get('staffSpecialty') || '' } : {}),
      } },
    };
    const files = form.getAll('adjuntos').filter((file) => file && file.name);

    try { validateUpdate(event, payload); } catch (error) { setErrorMessage(error.message); return; }
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

  const content = (
      <form className={embedded ? 'maintenance-inline-editor' : 'intervention-modal maintenance-update-modal'} aria-label={initialUpdate?.id ? 'Editar avance' : 'Registrar avance'} onSubmit={handleSubmit} onInvalidCapture={(event) => setErrorMessage(`Falta completar: ${event.target.closest('label')?.firstChild?.textContent?.trim() || event.target.getAttribute('aria-label') || 'un dato obligatorio'}.`)}>
        <div className="modal-heading">
          <div>
            <span className="panel-kicker">{event.titulo || 'Mantenimiento'}</span>
            <h2>{newEntry ? 'Completar actividad del registro creado' : initialUpdate?.id ? 'Corregir avance' : isObservationOnly ? 'Agregar observación' : 'Registrar avance'}</h2>
          </div>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Cerrar">x</button>
        </div>
        {newEntry && <p className="history-modal-note">El ingreso ya está guardado. Confirmá qué ocurrió durante este día para completar sus avances y el indicador de eficiencia.</p>}

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
          <input name="fecha" type="date" value={date} onChange={e => setDate(e.target.value)} min={event.fecha} max={today()} required />
        </label>

        <TimeSelect defaultValue={initialUpdate?.metadata?.horaEstimada ? '' : initialUpdate?.hora} required={false} label="Hora de la novedad (si se conoce)" />

        <label>
          ¿Quién intervino o informó la espera?
          <select name="responsable" value={staff} onChange={e => setStaff(e.target.value)} required={activity !== 'sin_dato'}>
            <option value="" disabled>Seleccionar turno</option>
            {staff && !responsibleOptions.includes(staff) && <option>{staff}</option>}
            {responsibleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>

        <label>
          {descriptionLabel}
          <VoiceTextarea name={isPause ? 'motivoPausa' : 'descripcion'} defaultValue={initialUpdate?.descripcion || ''} rows={4} required />
        </label>

        <fieldset className="tracking-fields"><legend>¿Qué ocurrió durante el período relevado?</legend>
          <div className="tracking-choices">{[['trabajo', 'Se trabajó'], ['espera', 'No se pudo trabajar'], ['mixto', 'Trabajo y demora'], ['sin_dato', 'Solo anotación / sin información']].map(([value, label]) => <button type="button" key={value} aria-pressed={activity === value} onClick={() => { setActivity(value); setFraction(''); }}>{label}</button>)}</div>
          {activity && activity !== 'sin_dato' && <>
            {['trabajo', 'mixto'].includes(activity) && <>
              <label>Especialidad del personal (si se conoce)<input name="staffSpecialty" defaultValue={saved.staffSpecialty || ''} placeholder="Ej.: eléctrico, mecánico" /></label>
              {!isLight(event) && <label>¿Cuánto tiempo se trabajó?<select name="workDurationDays" defaultValue={saved.workDurationDays ?? (saved.confirmedUnknownDuration ? 'unknown' : '')} required><option value="">Confirmar duración</option><option value="1">Jornada completa</option><option value="0.5">Media jornada</option><option value="unknown">Duración por confirmar</option></select></label>}
              <p className="tracking-hint">Media jornada de trabajo no implica media jornada de demora. Si quedó operativa, el tiempo posterior no se registra como pérdida.</p>
            </>}
            {event.tipo === 'correctivo' && ['trabajo', 'mixto'].includes(activity) && <>
              <label>¿De qué sistema hablamos?<select name="system" defaultValue={saved.system || (event.metadata?.seguimiento?.intake?.pendingSystem ? '' : event.metadata?.seguimiento?.system) || ''} required><option value="">Seleccionar sistema</option>{systems.filter(x => x !== 'Por confirmar').map(x => <option key={x}>{x}</option>)}</select></label>
              <label>¿Qué parte se trabajó en esta novedad?<input name="component" defaultValue={saved.component || (event.metadata?.seguimiento?.intake?.pendingSystem ? '' : event.metadata?.seguimiento?.component) || ''} required /></label>
            </>}
            <label>¿En qué turno? {staff === 'Turno fijo' && ['trabajo', 'mixto'].includes(activity) ? <input value="Mañana · turno fijo" readOnly /> : <select name="period" defaultValue={saved.period || ''} required><option value="">Seleccionar</option><option>Mañana</option><option>Tarde</option><option>Mañana y tarde</option><option>Día completo</option></select>}</label>
            {['espera', 'mixto'].includes(activity) && <label>¿Por qué no se pudo trabajar?<select name="cause" defaultValue={saved.cause || ''} required><option value="">Seleccionar causa</option>{Object.entries(causes).filter(([c]) => c !== 'PENDIENTE').map(([c, label]) => <option key={c} value={c}>{c} · {label}</option>)}</select></label>}
            {activity === 'espera' && <label className="tracking-confirm"><input type="checkbox" name="fullDay" defaultChecked={saved.fullDay} /> Confirmo que no se trabajó en todo el día</label>}
            <label className="tracking-confirm"><input type="checkbox" name="weekendEligible" defaultChecked={saved.weekendEligible} /> Trabajo excepcional previsto para este fin de semana</label>
            <label>Evaluación del día completo<select value={fraction} onChange={e => setFraction(e.target.value)}><option value="">Sin reparto adicional</option>{activity === 'mixto' ? <option value="0.5">50 % útil / 50 % pérdida</option> : activity === 'trabajo' ? <option value="1">100 % útil</option> : <option value="0">100 % pérdida</option>}</select></label>
            {date === today() && event.estadoMantenimiento !== 'finalizado' && <label className="tracking-confirm"><input key={date + activity} type="checkbox" name="dayComplete" defaultChecked={saved.dayComplete === true} /> Confirmo que terminó la jornada informada; el mantenimiento puede continuar.</label>}
            {fraction !== '' && <label>¿Qué justifica ese reparto?<input name="allocationNote" defaultValue={saved.allocationNote || ''} required /></label>}
            {activity === 'mixto' && fraction === '' && <p>La eficiencia quedará sin calcular hasta confirmar el reparto. Podés volver a este registro y corregirlo.</p>}
          </>}
          <label className="tracking-confirm"><input name="confirmActivity" type="checkbox" required /> Confirmo esta información{activity === 'sin_dato' ? ' y elijo dejar la actividad sin confirmar' : ''}.</label>
          <p className="tracking-hint">Mañana: 6–14 h · tarde: 14–22 h. Una salida acompañada o prueba pendiente genera una consulta de seguimiento, no trabajo supuesto.</p>
        </fieldset>
        <fieldset className="tracking-fields"><legend>¿Cómo quedó la máquina después de este día?</legend>
          <select aria-label="Estado posterior de la máquina" value={outcome} onChange={e => setOutcome(e.target.value)} required={activity !== 'sin_dato' || tipo === 'cierre' || Boolean(saved.outcome)}>
            <option value="">Confirmar estado posterior</option>
            {Object.entries(outcomeLabels).filter(([key]) => !(key === 'continua' && event.estadoMantenimiento === 'finalizado' && !beforeMaintenanceClosure(event, { ...initialUpdate, fecha: date, tipoActualizacion: tipo }))).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          {operationalOutcomes.includes(outcome) && event.estadoMantenimiento !== 'finalizado' && <p>Este registro cerrará el trabajo de mantenimiento en la fecha indicada.{outcome !== 'operativa' && ' La validación queda pendiente y se consultará al día siguiente desde las 9.'}</p>}
          {outcome === 'pendiente' && <label className="tracking-confirm"><input name="confirmUnknownOutcome" type="checkbox" required /> Elijo dejar el estado posterior sin confirmar.</label>}
        </fieldset>
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

        <p className="tracking-hint">El formulario te indicará los datos que falten antes de guardar. Revisá el texto dictado.</p>

        {errorMessage && (
          <div className="history-modal-note" role="alert">
            {errorMessage}
          </div>
        )}
      </form>
  );
  return embedded ? content : <div className="modal-backdrop" role="presentation">{content}</div>;
}
