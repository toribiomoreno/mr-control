-- Rollback de avances de mantenimiento
-- Usar solo si todavía no hay datos que deban conservarse.
begin;

drop trigger if exists recalcular_mantenimiento_por_actualizacion
on public.actualizaciones_evento;

drop trigger if exists validar_tipo_actualizacion_evento
on public.actualizaciones_evento;

drop trigger if exists actualizaciones_evento_set_updated_at
on public.actualizaciones_evento;

drop function if exists public.recalcular_mantenimiento_trigger();
drop function if exists public.recalcular_estado_mantenimiento(uuid);
drop function if exists public.validar_actualizacion_mantenimiento();
drop function if exists public.actualizaciones_set_updated_at();

alter table public.adjuntos_evento
  drop column if exists actualizacion_id;

drop table if exists public.actualizaciones_evento;

alter table public.eventos_historial
  drop constraint if exists eventos_estado_mantenimiento_valido,
  drop constraint if exists eventos_estado_unidad_resultante_valido,
  drop column if exists estado_mantenimiento,
  drop column if exists estado_unidad_resultante,
  drop column if exists fecha_cierre,
  drop column if exists hora_cierre,
  drop column if exists ultima_actividad_at;

commit;
