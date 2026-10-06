export const serviceRequirement = 16;
export const fleetStatus = value => ['servicio', 'operativa'].includes(value) ? 'operativa' : ['correctivo', 'preventivo', 'detenida'].includes(value) ? 'detenida' : ['uso_condicional', 'uso_excepcional'].includes(value) ? 'uso_excepcional' : value || 'sin_confirmar';
export const fleetStatusLabels = { operativa: 'Operativa', detenida: 'Detenida', reserva: 'Reserva', uso_excepcional: 'Uso excepcional', sin_confirmar: 'Sin confirmar' };
export function summarizeFleet(fleet) {
  const counts = { operativa: 0, detenida: 0, reserva: 0, uso_excepcional: 0, sin_confirmar: 0 };
  for (const loco of fleet) counts[fleetStatus(loco.estado)] = (counts[fleetStatus(loco.estado)] || 0) + 1;
  return { ...counts, total: fleet.length, required: serviceRequirement, balance: counts.operativa - serviceRequirement, coverage: Math.min(100, counts.operativa / serviceRequirement * 100) };
}
