-- Rollback de estado diario de flota e importaciones de Patio
begin;

drop index if exists public.estado_flota_actual_estado_idx;
drop index if exists public.historial_estados_flota_codigo_parte_idx;
drop index if exists public.actividades_calendario_patio_activa_unidad_idx;

drop table if exists public.actividades_calendario_patio;
drop table if exists public.historial_estados_flota;
drop table if exists public.estado_flota_actual;
drop table if exists public.importaciones_estado_flota;

commit;
