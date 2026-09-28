import { fleet, today } from '../domain/maintenance/types.js';
import { validDate } from '../domain/maintenance/adapter.js';
import { assertSupabaseConfig, supabase } from '../lib/supabase.js';
import { createHistorialEvent, mapEventRow } from './historialSupabaseService.js';

export async function fetchFleetConfirmations() {
  assertSupabaseConfig();
  const { data, error } = await supabase.from('eventos_historial').select('*')
    .eq('tipo', 'otro').eq('anulado', false).order('fecha', { ascending: false }).order('hora', { ascending: false });
  if (error) throw error;
  return (data || []).filter(row => row.metadata?.fleetConfirmation).map(mapEventRow);
}

export async function saveFleetConfirmation({ codigo, estado, fecha, hora, fuente }, locomotoras, responsable, maintenanceEvents = []) {
  if (!fleet.includes(codigo) || !locomotoras.some(loco => loco.codigo === codigo)) throw new Error('La locomotora no pertenece a la flota.');
  if (!['operativa', 'reserva', 'uso_excepcional'].includes(estado)) throw new Error('Elegí el estado confirmado.');
  if (!validDate(fecha) || fecha > today()) throw new Error('Ingresá una fecha válida que no sea futura.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new Error('Ingresá la hora del parte.');
  if (!fuente?.trim()) throw new Error('Indicá cómo confirmaste el estado.');
  const jobs = maintenanceEvents.filter(event => event.locomotoraCodigo === codigo && ['preventivo', 'correctivo'].includes(event.tipo) && !event.anulado);
  if (jobs.some(event => event.estadoMantenimiento !== 'finalizado')) throw new Error('Hay un mantenimiento abierto: cargá el avance y cerralo desde Mantenimientos.');
  const latestEnd = jobs.map(event => event.fechaCierre || event.fecha).sort().at(-1);
  if (latestEnd && fecha < latestEnd) throw new Error(`La confirmación debe ser del ${latestEnd} o posterior al último mantenimiento.`);
  const labels = { operativa: 'Operativa', reserva: 'Reserva', uso_excepcional: 'Uso excepcional' };
  return createHistorialEvent({
    locomotoraCodigo: codigo, fecha, hora, tipo: 'otro', titulo: `Estado confirmado: ${labels[estado]}`,
    descripcion: fuente.trim(), responsable: responsable || 'Por confirmar', origen: 'manual',
    metadata: { fleetConfirmation: { state: estado, source: 'manual' } }, criticidad: 'baja',
  }, [], locomotoras);
}
