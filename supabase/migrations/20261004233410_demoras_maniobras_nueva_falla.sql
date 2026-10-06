-- Amplía únicamente la lista de causas; conserva el resto de la validación vigente.
do $migration$
declare definition text; previous text := $$('MO','MAT','Acc','CAP','GES')$$; replacement text := $$('MO','MAT','Acc','CAP','GES','Man','FA')$$;
begin
  definition := pg_get_functiondef('public.validar_seguimiento_integrado()'::regprocedure);
  if position(replacement in definition) > 0 then return; end if;
  if position(previous in definition) = 0 then raise exception 'La lista de causas cambió; revisar la validación antes de migrar.'; end if;
  execute replace(definition, previous, replacement);
end $migration$;
