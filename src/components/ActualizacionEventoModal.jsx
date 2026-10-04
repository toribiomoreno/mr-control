import { causes, durations, today } from '../domain/maintenance/types.js';
import { isLight, validateUpdate } from '../domain/maintenance/adapter.js';
import { beforeMaintenanceClosure, operationalOutcomes, outcomeLabels } from '../domain/maintenance/view.js';
import { buildProgress } from '../domain/maintenance/capture.js';
import { nextShiftSelection } from '../domain/maintenance/journal.js';
import { useState } from 'react';
import VoiceTextarea from './VoiceTextarea.jsx';
import SystemFields from './SystemFields.jsx';
import TimeSelect from './TimeSelect.jsx';

const responsibleOptions = ['Turno fijo', 'Turno rotativo', 'Otro sector', 'Personal externo'];
export default function ActualizacionEventoModal({ event, mode = 'avance', initialUpdate = null, initialDate = '', newEntry = false, embedded = false, onClose, onSave }) {
  const saved = initialUpdate?.metadata?.seguimiento || {};
  const light = isLight(event);
  const observation = saved.activity === 'sin_dato' || (mode === 'observacion' && !initialUpdate?.id);
  const nextShift = nextShiftSelection(event);
  const [date, setDate] = useState(initialUpdate?.fecha || initialDate || today());
  const [staff, setStaff] = useState(initialUpdate?.responsable || (light ? 'Turno rotativo' : ''));
  const [duration, setDuration] = useState(saved.activity === 'espera' ? '0' : saved.workDurationDays == null ? '' : String(saved.workDurationDays));
  const [delayed, setDelayed] = useState(saved.delayReported === true || ['espera', 'mixto'].includes(saved.activity) ? 'yes' : initialUpdate?.id && saved.activity === 'trabajo' ? 'no' : '');
  const [outcome, setOutcome] = useState(saved.outcome || '');
  const [shift, setShift] = useState(saved.shiftNumber || nextShift.number);
  const [shiftResult, setShiftResult] = useState(saved.additionalShiftRequired ? 'extend' : saved.shiftFinished === true ? 'finished' : '');
  const [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const needsCause = delayed === 'yes' || (light && shiftResult === 'extend');
  const finalShift = light && Number(shift) >= durations[event.preventivoCodigo] && shiftResult === 'finished';
  const showOutcome = !light || finalShift || observation || initialUpdate?.tipoActualizacion === 'cierre';
  const implicitDate = !initialUpdate?.id && Boolean(initialDate);
  async function submit(e) {
    e.preventDefault(); setError('');
    const form = new FormData(e.currentTarget);
    try {
      const payload = buildProgress(event, initialUpdate, {
        observation, date, description: String(form.get('descripcion') || ''), staff,
        delayed: delayed === 'yes', noWork: delayed === 'yes' && duration === '0', duration,
        cause: form.get('cause') || '', delayDescription: String(form.get('delayDescription') || ''),
        system: form.get('system') || saved.system || '', subsystem: form.get('subsystem') || saved.subsystem || '',
        outcome: showOutcome ? outcome : saved.outcome || 'continua', outcomeConfirmed: form.get('confirmAvailability') === 'on',
        shiftNumber: shift, shiftFinished: shiftResult === 'finished', additionalShiftRequired: shiftResult === 'extend',
        shiftExtended: initialUpdate?.id ? saved.shiftExtended : nextShift.extended && Number(shift) === nextShift.number,
        extensionIndex: initialUpdate?.id ? saved.extensionIndex : nextShift.extensionIndex,
        period: form.get('period') || saved.period || 'Día completo',
        endTime: form.get('endTime') || '',
      });
      validateUpdate(event, payload);
      setSaving(true);
      await onSave(event, payload, []); onClose();
    } catch (err) { setError(err.message || 'No fue posible guardar el avance.'); }
    finally { setSaving(false); }
  }
  const content = <form className={embedded ? 'maintenance-inline-editor' : 'intervention-modal maintenance-update-modal'} aria-label={initialUpdate?.id ? 'Editar avance' : 'Registrar avance'} onSubmit={submit} onInvalidCapture={e => setError(`Falta completar: ${e.target.closest('label')?.firstChild?.textContent?.trim() || 'un dato obligatorio'}.`)}>
    <div className="modal-heading"><h3>{newEntry ? 'Completar actividad del registro creado' : initialUpdate?.id ? 'Editar avance' : observation ? 'Agregar novedad' : light ? 'Agregar avance por turno' : 'Agregar bloque de trabajo'}</h3><button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose}>×</button></div>
    {implicitDate ? <p className="tracking-hint">Fecha de trabajo: mismo día del bloque</p> : <label>{light ? 'Fecha del turno' : 'Fecha de trabajo'}<input name="fecha" type="date" value={date} onChange={e => setDate(e.target.value)} min={event.fecha} max={event.estadoMantenimiento === 'finalizado' && !observation ? event.fechaCierre : today()} required /></label>}
    {!observation && (light ? <>
      <label>Turno<select name="shiftNumber" value={shift} onChange={e => setShift(e.target.value)} required>{Array.from({ length: durations[event.preventivoCodigo] }, (_, i) => <option key={i + 1} value={i + 1}>Turno {i + 1}</option>)}</select></label>
      {(initialUpdate?.id ? saved.shiftExtended : nextShift.extended) && <p className="tracking-hint">Turno adicional · extensión {saved.extensionIndex || nextShift.extensionIndex}</p>}
      <label>¿Se pudo trabajar normalmente?<select value={delayed} onChange={e => setDelayed(e.target.value)} required><option value="">Seleccionar</option><option value="no">Sí</option><option value="yes">No, hubo una demora</option></select></label>
      <label>¿En qué turno se trabajó?<select name="period" defaultValue={saved.period || ''} required><option value="">Seleccionar</option><option>Mañana</option><option>Tarde</option>{initialUpdate?.id && ['Mañana y tarde','Día completo'].includes(saved.period) && <option>{saved.period}</option>}</select></label>
    </> : <>
      <SystemFields compact tracking={{ ...event.metadata?.seguimiento, ...saved }} legacy={Boolean(initialUpdate?.id && !saved.subsystem)} />
      <label>¿Quién la trabajó?<select name="responsable" value={staff} onChange={e => setStaff(e.target.value)} required><option value="">Seleccionar personal</option>{staff && !responsibleOptions.includes(staff) && <option>{staff}</option>}{responsibleOptions.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Jornada<select name="workDurationDays" value={duration} onChange={e => { setDuration(e.target.value); if (e.target.value === '0') setDelayed('yes'); }} required><option value="">Seleccionar</option><option value="1">Jornada completa</option><option value="0.5">Media jornada</option><option value="0">Sin trabajo · día de demora</option></select></label>
    </>)}
    <label>{light ? 'Descripción / novedad' : observation ? 'Novedad' : 'Descripción de lo que se hizo'}<VoiceTextarea name="descripcion" defaultValue={initialUpdate?.descripcion || ''} rows={3} required /></label>
    {!light && <fieldset className="tracking-fields availability-confirm"><legend>¿Cómo quedó la máquina?</legend>
      <select aria-label="Estado posterior de la máquina" value={outcome} onChange={e => setOutcome(e.target.value)}><option value="">Sin confirmar todavía</option>{Object.entries(outcomeLabels).filter(([key]) => key !== 'disponible' && !(key === 'continua' && event.estadoMantenimiento === 'finalizado' && !beforeMaintenanceClosure(event, { ...initialUpdate, fecha: date }))).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      {operationalOutcomes.includes(outcome) && <label className="tracking-confirm"><input name="confirmAvailability" type="checkbox" defaultChecked={saved.outcomeConfirmed && saved.outcome === outcome} required />Confirmo que quedó disponible en el estado indicado.</label>}
      {['prueba','prueba_parque','prueba_linea'].includes(outcome) && <p className="tracking-hint">Queda pendiente de prueba; se conserva detenida hasta confirmar su disponibilidad.</p>}
    </fieldset>}
    {!observation && (light ? <label>Resultado del turno<select value={shiftResult} onChange={e => setShiftResult(e.target.value)} required><option value="">Seleccionar</option><option value="finished">Damos el turno por finalizado</option><option value="extend">Se debió agregar otro turno</option></select></label> : <label>¿Tuviste alguna demora?<select value={delayed} onChange={e => { setDelayed(e.target.value); if (e.target.value === 'no' && duration === '0') setDuration(''); }} required><option value="">Seleccionar</option><option value="no">No</option><option value="yes">Sí</option></select></label>)}
    {!observation && needsCause && <fieldset className="tracking-fields maintenance-delay-fields"><legend>{light && shiftResult === 'extend' ? '¿Por qué se agregó otro turno?' : 'Demora registrada'}</legend>
      <label>Motivo de la demora<select name="cause" defaultValue={saved.extensionCause || saved.cause || ''} required><option value="">Seleccionar causa</option>{Object.entries(causes).filter(([key]) => key !== 'PENDIENTE').map(([key, label]) => <option key={key} value={key}>{key} · {label}</option>)}</select></label>
      <label>Descripción de la demora<VoiceTextarea name="delayDescription" defaultValue={saved.delayDescription || saved.extensionReason || saved.allocationNote || (saved.activity === 'espera' ? initialUpdate?.descripcion : '') || ''} rows={2} required /></label>
    </fieldset>}
    {light && showOutcome && <fieldset className="tracking-fields availability-confirm"><legend>Disponibilidad al terminar el mantenimiento</legend><select aria-label="Estado posterior de la máquina" value={outcome} onChange={e => setOutcome(e.target.value)}><option value="">Sin confirmar todavía</option>{Object.entries(outcomeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{operationalOutcomes.includes(outcome) && <label className="tracking-confirm"><input type="checkbox" name="confirmAvailability" defaultChecked={saved.outcomeConfirmed && saved.outcome === outcome} required />Confirmo que quedó disponible en el estado indicado.</label>}</fieldset>}
    {showOutcome && operationalOutcomes.includes(outcome) && <fieldset className="tracking-fields maintenance-end-fact"><legend>Fecha y hora de fin</legend><p>{date.split('-').reverse().join('/')}</p><TimeSelect name="endTime" label="Hora de fin (si se conoce)" defaultValue={initialUpdate?.hora || ''} required={false} /></fieldset>}
    <div className="modal-actions"><button type="button" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="primary-action" disabled={saving}>{saving ? 'Guardando…' : observation ? 'Guardar novedad' : 'Guardar avance'}</button></div>
    {error && <p className="history-modal-note" role="alert">{error}</p>}
  </form>;
  return embedded ? content : <div className="modal-backdrop">{content}</div>;
}
