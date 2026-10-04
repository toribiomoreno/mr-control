import { today, durations } from '../domain/maintenance/types.js';
import SystemFields from './SystemFields.jsx';
import TimeSelect from './TimeSelect.jsx';
import VoiceTextarea from './VoiceTextarea.jsx';

export default function SeguimientoFields({ tipo, code, tracking = {}, legacy = false }) {
  const light = tipo === 'preventivo' && Object.hasOwn(durations, code);
  return <fieldset className="tracking-fields">
    <legend>Datos para el seguimiento</legend>
    <label>¿Desde cuándo quedó detenida para esta intervención?
      <input type="date" name="detentionStart" defaultValue={tracking.detentionStart || ''} max={today()} required />
    </label>
    <TimeSelect name="detentionTime" defaultValue={tracking.detentionTime} required={false} label="Hora de detención (si se conoce)" />
    {tipo === 'preventivo' && <><label>Inicio programado<input type="date" name="plannedStart" defaultValue={tracking.plannedStart || ''} /></label><TimeSelect name="plannedStartTime" defaultValue={tracking.plannedStartTime} required={false} label="Hora de inicio programado" /><label>Fin programado<input type="date" name="plannedEnd" defaultValue={tracking.plannedEnd || ''} /></label><TimeSelect name="plannedEndTime" defaultValue={tracking.plannedEndTime} required={false} label="Hora de fin programado" /><p className="tracking-hint">Si la programación todavía no está confirmada, dejá el campo pendiente. El fin previsto no libera la locomotora.</p></>}
    {tipo === 'correctivo' && <label>¿Por qué quedó detenida la máquina?
      <VoiceTextarea name="detentionReason" defaultValue={tracking.detentionReason || ''} rows={2} placeholder="Motivo de ingreso a este correctivo" required />
    </label>}
    {tipo === 'correctivo' ? <SystemFields tracking={tracking} legacy={legacy} /> : <p>{light ? `Locomotora completa · turno rotativo · ${durations[code]} turno(s) de 8 horas.` : 'Preventivo pesado · numeral del 1 al 12.'}</p>}
    <p className="tracking-hint">Después del ingreso, registrá cuándo se trabajó, quién intervino, las demoras y cómo quedó la máquina. Los preventivos livianos abarcan toda la locomotora.</p>
  </fieldset>;
}
