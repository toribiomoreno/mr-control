import { systems, today, durations } from '../domain/maintenance/types.js';

export default function SeguimientoFields({ tipo, code, tracking = {} }) {
  const light = tipo === 'preventivo' && Object.hasOwn(durations, code);
  return <fieldset className="tracking-fields">
    <legend>Datos para el seguimiento</legend>
    <label>¿Desde cuándo quedó detenida para esta intervención?
      <input type="date" name="detentionStart" defaultValue={tracking.detentionStart || ''} max={today()} required />
    </label>
    <label>¿Dónde se realiza?
      <select name="location" defaultValue={tracking.location || ''} required><option value="">Seleccionar</option><option>Boulogne</option><option value="Externo">Externo</option></select>
    </label>
    {tipo === 'correctivo' ? <>
      <label>¿Qué sistema estamos atacando?<select name="system" defaultValue={tracking.system || ''} required><option value="">Seleccionar sistema</option>{systems.filter(x => x !== 'Por confirmar').map(x => <option key={x}>{x}</option>)}</select></label>
      <label>¿Qué parte o componente?<input name="component" defaultValue={tracking.component || ''} placeholder="Ej.: compresor, cojinete MT…" required /></label>
    </> : <p>Motivo: kilometraje. {light ? `Locomotora completa · turno rotativo · ${durations[code]} turno(s) de 8 horas.` : 'Preventivo pesado · numeral del 1 al 12.'}</p>}
    <p className="tracking-hint">Registrar el inicio no confirma que se haya trabajado. Cargá luego la actividad de cada día. El cierre del mantenimiento tampoco cambia automáticamente el estado del Patio.</p>
  </fieldset>;
}
