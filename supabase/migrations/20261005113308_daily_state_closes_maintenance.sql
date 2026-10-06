-- Declarar Operativa en el parte es una confirmación de cierre, no un avance de trabajo.
-- El trigger comparte la transacción del lote y respeta los permisos de quien carga.
create or replace function public.cerrar_mantenimiento_por_estado_diario()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  job public.eventos_historial;
  closed_ids jsonb := '[]'::jsonb;
  remaining_ids jsonb;
  close_id uuid;
  report_at timestamp;
begin
  if new.tipo <> 'otro' or new.anulado or new.metadata->'dailyState'->>'reportedState' is distinct from 'operativa' then
    return new;
  end if;
  if new.fecha is null or new.hora is null then
    raise exception 'Confirmá fecha y hora del parte antes de declarar disponibilidad.';
  end if;
  report_at := new.fecha + new.hora;
  for job in
    select e.* from public.eventos_historial e
    where e.locomotora_codigo = new.locomotora_codigo and e.tipo in ('preventivo','correctivo')
      and not e.anulado and coalesce(e.estado_mantenimiento,'en_curso') not in ('finalizado','cancelado')
      and e.fecha + coalesce(e.hora,'00:00'::time) <= report_at
      and (e.metadata->'seguimiento'->'detentionAfterReport' is null
        or report_at > (e.metadata->'seguimiento'->'detentionAfterReport'->>'date')::date
          + (e.metadata->'seguimiento'->'detentionAfterReport'->>'time')::time)
      and not exists (
        select 1 from public.actualizaciones_evento a where a.evento_id=e.id
          and a.tipo_actualizacion <> 'observacion'
          and a.fecha + coalesce(a.hora,case a.metadata->'seguimiento'->>'period'
            when 'Mañana' then '06:00'::time when 'Tarde' then '14:00'::time else '00:00'::time end) > report_at
      )
    order by e.id for update
  loop
    insert into public.actualizaciones_evento
      (evento_id,fecha,hora,tipo_actualizacion,descripcion,responsable,estado_resultante,estado_unidad_resultante,metadata)
    values (job.id,new.fecha,new.hora,'cierre',
      'Disponibilidad confirmada por el estado diario. Cierre del mantenimiento sin atribuir trabajos ni duración.',
      coalesce(new.responsable,'Parte diario'),'finalizado','servicio',
      jsonb_build_object('dailyStateClosure',jsonb_build_object('reportId',new.id,'source','parte-diario','confirmedBy',auth.uid(),
        'previousMaintenanceState',job.estado_mantenimiento,'previousTracking',job.metadata->'seguimiento'),
        'seguimiento',jsonb_build_object('captureVersion',3,'activity','sin_dato','confirmedUnknownActivity',true,
          'outcome','operativa','outcomeConfirmed',true))) returning id into close_id;
    update public.eventos_historial set estado_mantenimiento='finalizado',fecha_cierre=new.fecha,hora_cierre=new.hora,
      estado_unidad_resultante='servicio',
      metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('dailyStateClosure',jsonb_build_object('reportId',new.id,'updateId',close_id))
        || case when metadata->'seguimiento' is not null then jsonb_build_object('seguimiento',metadata->'seguimiento'
          || jsonb_build_object('outcome','operativa','outcomeConfirmed',true,'availableDate',new.fecha,'confirmedThrough',new.fecha)) else '{}'::jsonb end
      where id=job.id;
    if not found then raise exception 'No fue posible cerrar un mantenimiento. El parte no se guardó.'; end if;
    closed_ids := closed_ids || jsonb_build_array(job.id);
  end loop;
  -- Un parte antiguo no pisa un cierre posterior ni una intervención posterior conocida.
  select coalesce(jsonb_agg(e.id),'[]'::jsonb) into remaining_ids from public.eventos_historial e
  where e.locomotora_codigo=new.locomotora_codigo and e.tipo in ('preventivo','correctivo') and not e.anulado
    and e.estado_mantenimiento is distinct from 'cancelado'
    and e.fecha + coalesce(e.hora,'00:00'::time) <= report_at
    and (e.metadata->'seguimiento'->'detentionAfterReport' is null
      or report_at > (e.metadata->'seguimiento'->'detentionAfterReport'->>'date')::date
        + (e.metadata->'seguimiento'->'detentionAfterReport'->>'time')::time)
    and (e.estado_mantenimiento is distinct from 'finalizado'
      or coalesce(e.fecha_cierre,e.fecha) + coalesce(e.hora_cierre,'23:59'::time) > report_at);
  new.metadata := jsonb_set(new.metadata,'{dailyState}',new.metadata->'dailyState' || jsonb_build_object(
    'state',case when jsonb_array_length(remaining_ids)>0 then 'detenida' else 'operativa' end,
    'conflict',jsonb_array_length(remaining_ids)>0,'needsMaintenance',false,'maintenanceIds',remaining_ids,
    'closingMaintenanceIds','[]'::jsonb,'closedMaintenanceIds',coalesce(new.metadata->'dailyState'->'closedMaintenanceIds','[]'::jsonb)||closed_ids));
  return new;
end;
$$;
revoke all on function public.cerrar_mantenimiento_por_estado_diario() from public,anon,authenticated;
drop trigger if exists cerrar_mantenimiento_por_estado_diario on public.eventos_historial;
create trigger cerrar_mantenimiento_por_estado_diario
before insert or update of metadata on public.eventos_historial
for each row execute function public.cerrar_mantenimiento_por_estado_diario();
