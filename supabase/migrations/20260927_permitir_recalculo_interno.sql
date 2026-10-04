-- El trigger de novedades ejecuta esta función con el rol autenticado.
grant execute on function public.recalcular_estado_mantenimiento(uuid) to authenticated;
