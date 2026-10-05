import { useState } from 'react';
import { maintenanceTypes, intakeTime } from '../domain/maintenance/capture.js';
import { detentionReason } from '../domain/maintenance/view.js';
import { today } from '../domain/maintenance/types.js';
import TimeSelect from './TimeSelect.jsx';
import VoiceTextarea from './VoiceTextarea.jsx';

export default function MaintenanceIntakeFields({ event, locomotoras, legend = 'Editar datos del mantenimiento', onTypeChange, onStartDateChange, disabled = false }) {
  const [type, setType] = useState(event.tipo === 'correctivo' ? 'Correctivo' : event.preventivoCodigo);
  return <fieldset className="tracking-fields maintenance-intake-fields" disabled={disabled}><legend>{legend}</legend>
    <label>Equipo<select name="unit" defaultValue={event.locomotoraCodigo} required>{locomotoras.map(l => <option key={l.codigo} value={l.codigo}>{l.codigo}</option>)}</select></label>
    <label>Tipo de mantenimiento<select name="maintenanceType" value={type} onChange={e => { setType(e.target.value); onTypeChange?.(e.target.value); }} required>{maintenanceTypes.map(t => <option key={t} value={t}>{t === 'Correctivo' ? t : `Preventivo ${t}`}</option>)}</select></label>
    <label>Motivo del ingreso<VoiceTextarea name="reason" defaultValue={event.id ? detentionReason(event) : event.metadata?.seguimiento?.detentionReason || ''} rows={2} required /></label>
    <label>Fecha de ingreso<input type="date" name="startDate" defaultValue={event.metadata?.seguimiento?.detentionStart || event.fecha} onChange={e => onStartDateChange?.(e.target.value)} max={today()} required /></label>
    <TimeSelect name="startTime" defaultValue={intakeTime(event)} label="Hora de ingreso (si se conoce)" required={false} />
  </fieldset>;
}
