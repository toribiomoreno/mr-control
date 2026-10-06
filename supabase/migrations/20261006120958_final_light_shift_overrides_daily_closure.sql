-- A real final-shift confirmation takes precedence over the later daily report.
create or replace function public.confirmar_fin_turno_liviano()
returns trigger language plpgsql set search_path = public as $$
declare parent public.eventos_historial; t jsonb := new.metadata->'seguimiento'; target_id uuid; end_time time;
begin
  if coalesce(t->>'completedFinalShift','false') <> 'true' then return new; end if;
  select * into parent from public.eventos_historial where id=new.evento_id for update;
  if parent.tipo <> 'preventivo' or parent.preventivo_codigo not in ('E','A','AB','ABC')
    or coalesce(t->>'shiftFinished','false') <> 'true' or coalesce(t->>'additionalShiftRequired','false')='true'
    or coalesce(t->>'outcomeConfirmed','false') <> 'true' or t->>'outcome' not in ('operativa','disponible','acompanada','operativa_prueba')
    or coalesce((t->>'shiftNumber')::integer,0) < (case parent.preventivo_codigo when 'E' then 1 when 'A' then 2 when 'AB' then 3 when 'ABC' then 6 end) then return new; end if;
  if exists(select 1 from public.actualizaciones_evento a where a.evento_id=new.evento_id and a.fecha>new.fecha and coalesce(a.metadata->'seguimiento'->>'activity','sin_dato') <> 'sin_dato') then
    raise exception 'Hay actividad posterior al turno final. Revisá los avances antes de corregir el cierre.';
  end if;
  target_id := nullif(parent.metadata->'dailyStateClosure'->>'updateId','')::uuid;
  if target_id is null then return new; end if;
  end_time := coalesce(new.hora,case t->>'period' when 'Mañana' then '14:00'::time when 'Tarde' then '22:00'::time end);
  if end_time is null then return new; end if;
  update public.actualizaciones_evento set fecha=new.fecha,hora=end_time,
    metadata=metadata || jsonb_build_object('finalShiftCorrection',jsonb_build_object('updateId',new.id,'previousDate',fecha,'previousTime',hora)),
    updated_at=now()
  where id=target_id and evento_id=new.evento_id and metadata ? 'dailyStateClosure' and tipo_actualizacion='cierre';
  if found then
    update public.eventos_historial set fecha_cierre=new.fecha,hora_cierre=end_time,
      metadata=jsonb_set(metadata,'{seguimiento}',coalesce(metadata->'seguimiento','{}') || jsonb_build_object('availableDate',new.fecha,'availableTime',end_time,'outcome',t->>'outcome','outcomeConfirmed',true,'confirmedThrough',new.fecha)),updated_at=now()
    where id=new.evento_id;
  end if;
  return new;
end $$;
revoke all on function public.confirmar_fin_turno_liviano() from public,anon;
grant execute on function public.confirmar_fin_turno_liviano() to authenticated;
drop trigger if exists zz_confirmar_fin_turno_liviano on public.actualizaciones_evento;
create trigger zz_confirmar_fin_turno_liviano after insert or update on public.actualizaciones_evento for each row execute function public.confirmar_fin_turno_liviano();
