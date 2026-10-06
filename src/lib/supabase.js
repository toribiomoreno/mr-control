import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigError = !supabaseUrl || !supabasePublishableKey
  ? 'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY.'
  : '';

export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl, supabasePublishableKey);

export function assertSupabaseConfig() {
  if (supabaseConfigError || !supabase) {
    throw new Error('No fue posible conectarse con Supabase.');
  }
}

export async function assertSeguimientoReady() {
  assertSupabaseConfig();
  const { data, error } = await supabase.rpc('seguimiento_version');
  if (error || data !== 1) throw new Error('La base aún no tiene habilitada la integración segura de seguimiento. Aplicá y verificá la migración antes de cargar mantenimientos.');
}
