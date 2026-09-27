import { systems, today, durations } from '../domain/maintenance/types.js';

export default function SeguimientoFields({ tipo, code, tracking = {} }) {
  const light = tipo === 'preventivo' && Object.hasOwn(durations, code);
  return <fieldset className="tracking-fields">
    <legend>Datos para el seguimiento</legend>
    <label>¿Desde cuándo quedó detenida para esta intervención?
      <input type="date" name="detentionStart" defaultValue={tracking.detentionStart || ''} max={today()} required />
    </label>
    {tipo === 'correctivo' && <label>¿Por qué quedó detenida la máquina?
      <input name="detentionReason" defaultValue={tracking.detentionReason || ''} placeholder="Motivo de ingreso a este correctivo" required />
    </label>}
    <label>¿Dónde se realiza?
      <select name="location" defaultValue={tracking.location || ''} required><option value="">Seleccionar</option><option>Boulogne</option><option value="Externo">Externo</option></select>
    </label>
    {tipo === 'correctivo' ? <>
      <label>¿Qué sistema estamos atacando?<select name="system" defaultValue={tracking.system || ''} required><option value="">Seleccionar sistema</option>{systems.filter(x => x !== 'Por confirmar').map(x => <option key={x}>{x}</option>)}</select></label>
      <label>¿Qué parte o componente?<input name="component" defaultValue={tracking.component || ''} placeholder="Ej.: compresor, cojinete MT…" required /></label>
    </> : <p>Motivo: kilometraje. {light ? `Locomotora completa · turno rotativo · ${durations[code]} turno(s) de 8 horas.` : 'Preventivo pesado · numeral del 1 al 12.'}</p>}
    <p className="tracking-hint">Después del ingreso, registrá cuándo se trabajó, quién intervino, las demoras y cómo quedó la máquina. Los preventivos livianos abarcan toda la locomotora.</p>
  </fieldset>;
}
