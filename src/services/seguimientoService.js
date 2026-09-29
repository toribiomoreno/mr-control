import { supabase, assertSupabaseConfig, assertSeguimientoReady } from '../lib/supabase.js';
import { mapEventRow } from './historialSupabaseService.js';
import { mapActualizacionRow } from './actualizacionesEventoSupabaseService.js';
import { validateEvent } from '../domain/maintenance/adapter.js';
import { trackingForCurrentState } from '../domain/maintenance/view.js';

async function pages(table, configure) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await configure(supabase.from(table).select('*')).order('id').range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export async function fetchSeguimiento() {
  assertSupabaseConfig();
  await assertSeguimientoReady();
  const rows = await pages('eventos_historial', q => q.in('tipo', ['preventivo', 'correctivo']).eq('anulado', false));
  const updates = [];
  for (let offset = 0; offset < rows.length; offset += 100) {
    const ids = rows.slice(offset, offset + 100).map(r => r.id);
    updates.push(...await pages('actualizaciones_evento', q => q.in('evento_id', ids)));
  }
  return rows.map(row => ({ ...mapEventRow(row), actualizaciones: updates.filter(a => a.evento_id === row.id).map(a => mapActualizacionRow(a)).sort((a,b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)) }));
}
export async function saveTracking(event, tracking) {
  await assertSeguimientoReady();
  const next = { ...event, metadata: { ...event.metadata, seguimiento: trackingForCurrentState(event, tracking) } };
  validateEvent(next);
  const { data, error } = await supabase.from('eventos_historial').update({ metadata: next.metadata }).eq('id', event.id).eq('metadata', JSON.stringify(event.metadata || {})).select('id');
  if (error) throw error;
  if (!data.length) throw new Error('Otra persona modificó este registro. Actualizá la vista antes de guardar.');
}
