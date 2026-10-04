import { useState } from 'react';
import { systems, subsystemsBySystem } from '../domain/maintenance/taxonomy.js';

export default function SystemFields({ tracking = {}, required = true, legacy = false, compact = false }) {
  const [system, setSystem] = useState(tracking.intake?.pendingSystem ? '' : tracking.system || '');
  const [subsystem, setSubsystem] = useState(tracking.subsystem || '');
  return <>
    <label>¿Qué sistema estamos atacando?<select name="system" value={system} onChange={e => { setSystem(e.target.value); setSubsystem(''); }} required={required}>
      <option value="">Seleccionar sistema</option>
      {system && !systems.includes(system) && <option value={system}>{system} · registro anterior</option>}
      {systems.map(value => <option key={value}>{value}</option>)}
    </select></label>
    <label>Subsistema<select aria-label="Subsistema" name="subsystem" value={subsystem} onChange={e => setSubsystem(e.target.value)} required={required && !legacy}>
      <option value="">{legacy ? 'Sin clasificar · registro anterior' : 'Seleccionar subsistema'}</option>
      {subsystem && !(subsystemsBySystem[system] || []).includes(subsystem) && <option value={subsystem}>{subsystem} · registro anterior</option>}
      {(subsystemsBySystem[system] || []).map(value => <option key={value}>{value}</option>)}
    </select></label>
    {!compact && <label>Detalle de la parte intervenida (opcional)<textarea name="component" defaultValue={tracking.component || ''} rows={2} placeholder="Ej.: eje 2, lado derecho; válvula 26-C" /></label>}
  </>;
}
