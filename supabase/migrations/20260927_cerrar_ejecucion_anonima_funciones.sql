-- Los permisos directos de anon sobreviven a REVOKE ... FROM PUBLIC en proyectos existentes.
do $$
declare f record;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' loop
    execute format('revoke execute on function %s from public, anon', f.oid::regprocedure);
  end loop;
end $$;

-- Estas funciones se ejecutan por triggers; no necesitan invocación vía Data API.
do $$
declare function_name text;
begin
  foreach function_name in array array[
    'public.auditar_seguimiento()',
    'public.crear_perfil_nuevo_usuario()',
    'public.normalizar_nombre_importacion_libro()'
  ] loop
    if to_regprocedure(function_name) is not null then
      execute format('revoke execute on function %s from authenticated', function_name);
    end if;
  end loop;
end $$;

grant execute on function public.mr_access(boolean) to authenticated;
grant execute on function public.mr_developer() to authenticated;
grant execute on function public.importar_seguimiento_piloto(jsonb) to authenticated;
grant execute on function public.seguimiento_version() to authenticated;
