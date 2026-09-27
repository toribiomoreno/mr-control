-- Aplicar en staging y verificar roles antes de producción. No incluye datos de empresa.
begin;

create or replace function public.mr_access(write_access boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.perfiles p where p.id = auth.uid() and p.activo = true
    and (not write_access or p.rol in ('supervisor','jefatura') or p.es_desarrollador = true));
$$;
revoke all on function public.mr_access(boolean) from public;
grant execute on function public.mr_access(boolean) to authenticated;

-- Restrictive policies intersect any prior permissive development policy.
-- Explicit authenticated policies allow the same roles as the app; anonymous access is revoked.
do $$
declare tbl text;
begin
  foreach tbl in array array['eventos_historial','actualizaciones_evento','adjuntos_evento'] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on public.%I from anon', tbl);
    execute format('grant select, insert, update, delete on public.%I to authenticated', tbl);
    execute format('drop policy if exists mr_read_guard on public.%I', tbl);
    execute format('drop policy if exists mr_read on public.%I', tbl);
    execute format('create policy mr_read_guard on public.%I as restrictive for select to authenticated using (public.mr_access(false))', tbl);
    execute format('create policy mr_read on public.%I for select to authenticated using (public.mr_access(false))', tbl);
    execute format('drop policy if exists mr_insert_guard on public.%I', tbl);
    execute format('drop policy if exists mr_update_guard on public.%I', tbl);
    execute format('drop policy if exists mr_delete_guard on public.%I', tbl);
    execute format('drop policy if exists mr_write on public.%I', tbl);
    execute format('create policy mr_insert_guard on public.%I as restrictive for insert to authenticated with check (public.mr_access(true))', tbl);
    execute format('create policy mr_update_guard on public.%I as restrictive for update to authenticated using (public.mr_access(true)) with check (public.mr_access(true))', tbl);
    execute format('create policy mr_delete_guard on public.%I as restrictive for delete to authenticated using (public.mr_access(true))', tbl);
    execute format('create policy mr_write on public.%I for all to authenticated using (public.mr_access(true)) with check (public.mr_access(true))', tbl);
  end loop;
end $$;

-- Profiles must not allow self-promotion through a legacy permissive policy.
create or replace function public.mr_developer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.perfiles where id = auth.uid() and activo = true and es_desarrollador = true);
$$;
revoke all on function public.mr_developer() from public;
grant execute on function public.mr_developer() to authenticated;
alter table public.perfiles enable row level security;
revoke all on public.perfiles from anon;
drop policy if exists mr_profile_read_guard on public.perfiles;
create policy mr_profile_read_guard on public.perfiles as restrictive for select to authenticated using(id = auth.uid() or public.mr_developer());
drop policy if exists mr_profile_read on public.perfiles;
create policy mr_profile_read on public.perfiles for select to authenticated using(id = auth.uid() or public.mr_developer());
drop policy if exists mr_profile_insert_guard on public.perfiles;
create policy mr_profile_insert_guard on public.perfiles as restrictive for insert to authenticated with check(public.mr_developer());
drop policy if exists mr_profile_update_guard on public.perfiles;
create policy mr_profile_update_guard on public.perfiles as restrictive for update to authenticated using(public.mr_developer()) with check(public.mr_developer());
drop policy if exists mr_profile_delete_guard on public.perfiles;
create policy mr_profile_delete_guard on public.perfiles as restrictive for delete to authenticated using(public.mr_developer());

update storage.buckets set public = false where id = 'eventos-adjuntos';
drop policy if exists mr_attachment_read_guard on storage.objects;
create policy mr_attachment_read_guard on storage.objects as restrictive for select to public using(bucket_id <> 'eventos-adjuntos' or (auth.uid() is not null and public.mr_access(false)));
drop policy if exists mr_attachment_insert_guard on storage.objects;
create policy mr_attachment_insert_guard on storage.objects as restrictive for insert to public with check(bucket_id <> 'eventos-adjuntos' or (auth.uid() is not null and public.mr_access(true)));
drop policy if exists mr_attachment_update_guard on storage.objects;
create policy mr_attachment_update_guard on storage.objects as restrictive for update to public using(bucket_id <> 'eventos-adjuntos' or (auth.uid() is not null and public.mr_access(true))) with check(bucket_id <> 'eventos-adjuntos' or (auth.uid() is not null and public.mr_access(true)));
drop policy if exists mr_attachment_delete_guard on storage.objects;
create policy mr_attachment_delete_guard on storage.objects as restrictive for delete to public using(bucket_id <> 'eventos-adjuntos' or (auth.uid() is not null and public.mr_access(true)));

-- A post-close observation must preserve the close and availability state.
create or replace function public.recalcular_estado_mantenimiento(p_evento_id uuid)
returns void language plpgsql set search_path = public as $$
declare a public.actualizaciones_evento;
begin
  select * into a from public.actualizaciones_evento
  where evento_id = p_evento_id and tipo_actualizacion <> 'observacion' and estado_resultante is not null
  order by fecha desc,hora desc nulls last,created_at desc limit 1;
  if found then
    update public.eventos_historial set estado_mantenimiento = a.estado_resultante,
      fecha_cierre = case when a.estado_resultante in ('finalizado','cancelado') then a.fecha end,
      hora_cierre = case when a.estado_resultante in ('finalizado','cancelado') then a.hora end,
      estado_unidad_resultante = coalesce(a.estado_unidad_resultante,estado_unidad_resultante),
      ultima_actividad_at = now(),updated_at = now() where id = p_evento_id;
  else
    update public.eventos_historial set ultima_actividad_at = now(),updated_at = now() where id = p_evento_id;
  end if;
end $$;

create unique index if not exists mantenimiento_pilot_source on public.eventos_historial ((metadata->>'pilotSourceId')) where metadata ? 'pilotSourceId';
create unique index if not exists seguimiento_one_assessment on public.actualizaciones_evento (evento_id,fecha) where metadata->'seguimiento'->>'usefulFraction' is not null;

create or replace function public.validar_seguimiento_integrado()
returns trigger language plpgsql set search_path = public as $$
declare t jsonb; parent public.eventos_historial; f numeric; d date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  t := new.metadata->'seguimiento';
  -- Legacy rows are retained as incomplete; newly entered maintenance facts require tracking.
  if tg_table_name = 'eventos_historial' then
    if new.tipo not in ('preventivo','correctivo') then return new; end if;
    if tg_op = 'UPDATE' and t is null then return new; end if;
    if t is null or t->>'location' not in ('Boulogne','Externo') or nullif(t->>'detentionStart','') is null then raise exception 'Confirmá ubicación y comienzo de la detención.'; end if;
    if new.fecha > d or (t->>'detentionStart')::date > new.fecha then raise exception 'Fechas de inicio o detención inválidas.'; end if;
    if new.locomotora_codigo !~ '^(E7(0[1-9]|1[0-9]|2[01])|7754|7763|7746|7774|EM01|EM02)$' then raise exception 'Unidad fuera de flota.'; end if;
    if new.tipo = 'correctivo' and (nullif(t->>'system','') is null or t->>'system' = 'Por confirmar' or nullif(btrim(t->>'component'),'') is null) then raise exception 'Indicá sistema y componente.'; end if;
    if new.tipo = 'preventivo' and coalesce(new.preventivo_codigo,'') !~ '^(E|A|AB|ABC|Numeral ([1-9]|1[0-2]))$' then raise exception 'Código preventivo inválido.'; end if;
    if new.tipo = 'preventivo' and new.preventivo_codigo in ('E','A','AB','ABC') then
      if new.responsable is distinct from 'Turno rotativo' then raise exception 'El preventivo liviano corresponde al turno rotativo.'; end if;
      new.metadata := jsonb_set(new.metadata, '{seguimiento}', t || '{"system":"Varios sistemas","component":"Locomotora completa"}'::jsonb);
    end if;
    if new.fecha_cierre is not null and (new.fecha_cierre < new.fecha or new.fecha_cierre > d) then raise exception 'Cierre inválido.'; end if;
    if exists(select 1 from public.actualizaciones_evento a where a.evento_id = new.id and (a.fecha < new.fecha or (new.fecha_cierre is not null and a.fecha > new.fecha_cierre and a.metadata->'seguimiento'->>'activity' <> 'sin_dato'))) then raise exception 'Las fechas dejan actividad fuera del mantenimiento.'; end if;
    return new;
  end if;
  select * into parent from public.eventos_historial where id = new.evento_id for update;
  if not found then raise exception 'Mantenimiento inexistente.'; end if;
  if tg_op = 'UPDATE' and new.evento_id <> old.evento_id then raise exception 'No se puede trasladar una novedad.'; end if;
  new.estado_resultante := case new.tipo_actualizacion when 'cierre' then 'finalizado' when 'pausa' then 'pausado' when 'reanudacion' then 'en_curso' when 'reapertura' then 'en_curso' when 'avance' then 'en_curso' else null end;
  if t is null or coalesce(t->>'activity','') not in ('trabajo','espera','mixto','sin_dato') then raise exception 'Confirmá la actividad del período.'; end if;
  if new.fecha < parent.fecha or new.fecha > d then raise exception 'Fecha de novedad inválida.'; end if;
  if parent.estado_mantenimiento = 'finalizado' then
    if new.tipo_actualizacion <> 'observacion' and not (tg_op = 'UPDATE' and new.tipo_actualizacion = old.tipo_actualizacion) then raise exception 'El mantenimiento está cerrado.'; end if;
    if t->>'activity' <> 'sin_dato' and new.fecha > parent.fecha_cierre then raise exception 'Actividad posterior al cierre.'; end if;
  end if;
  if t->>'activity' <> 'sin_dato' then
    if parent.tipo = 'correctivo' and t->>'activity' in ('trabajo','mixto') and
      (coalesce(nullif(t->>'system',''), parent.metadata->'seguimiento'->>'system', 'Por confirmar') = 'Por confirmar' or
       nullif(btrim(coalesce(nullif(t->>'component',''), parent.metadata->'seguimiento'->>'component','')),'') is null) then raise exception 'Confirmá sistema y parte atacada.'; end if;
    if nullif(new.responsable,'') is null or coalesce(t->>'period','') not in ('Mañana','Tarde','Mañana y tarde','Día completo') then raise exception 'Confirmá personal y turno.'; end if;
    if t->>'activity' in ('trabajo','mixto') and new.responsable = 'Turno fijo' and t->>'period' <> 'Mañana' then raise exception 'Turno fijo: mañana.'; end if;
    if t->>'activity' in ('trabajo','mixto') and parent.tipo = 'preventivo' and parent.preventivo_codigo in ('E','A','AB','ABC') and new.responsable <> 'Turno rotativo' then raise exception 'Preventivo liviano: turno rotativo.'; end if;
  end if;
  if t->>'activity' in ('espera','mixto') and coalesce(t->>'cause','') not in ('MO','MAT','Acc','CAP','GES') then raise exception 'Confirmá causa de demora.'; end if;
  if t->>'usefulFraction' is not null then
    f := (t->>'usefulFraction')::numeric;
    if f not in (0,0.5,1) or nullif(btrim(t->>'allocationNote'),'') is null then raise exception 'Reparto inválido o sin explicación.'; end if;
    if not ((t->>'activity' = 'mixto' and f = 0.5) or (t->>'activity' = 'trabajo' and f = 1) or (t->>'activity' = 'espera' and f = 0)) then raise exception 'El reparto no coincide con la actividad.'; end if;
    if new.fecha = d and new.tipo_actualizacion <> 'cierre' and parent.estado_mantenimiento <> 'finalizado' then raise exception 'El día sigue en curso.'; end if;
  end if;
  if coalesce((t->>'fullDay')::boolean,false) then
    if t->>'activity' <> 'espera' or t->>'period' <> 'Día completo' then raise exception 'Revisá el período del día completo.'; end if;
    if new.fecha = d and new.tipo_actualizacion <> 'cierre' and parent.estado_mantenimiento <> 'finalizado' then raise exception 'Hoy sigue en curso.'; end if;
  end if;
  if exists(select 1 from public.actualizaciones_evento a where a.evento_id = new.evento_id and a.id <> new.id and a.fecha = new.fecha and
    ((t->>'activity' in ('trabajo','mixto') and a.metadata->'seguimiento'->>'activity' = 'espera' and a.metadata->'seguimiento'->>'fullDay' = 'true') or
     (t->>'activity' = 'espera' and t->>'fullDay' = 'true' and a.metadata->'seguimiento'->>'activity' in ('trabajo','mixto')))) then raise exception 'El trabajo contradice una espera de día completo.'; end if;
  return new;
end $$;
drop trigger if exists validar_seguimiento on public.eventos_historial;
create trigger validar_seguimiento before insert or update on public.eventos_historial for each row execute function public.validar_seguimiento_integrado();
drop trigger if exists validar_seguimiento on public.actualizaciones_evento;
create trigger validar_seguimiento before insert or update on public.actualizaciones_evento for each row execute function public.validar_seguimiento_integrado();

create table if not exists public.auditoria_seguimiento (
  id bigint generated always as identity primary key, fecha timestamptz not null default now(), usuario uuid,
  tabla text not null, accion text not null, registro_id text not null, antes jsonb, despues jsonb
);
alter table public.auditoria_seguimiento enable row level security;
revoke all on public.auditoria_seguimiento from anon, authenticated;
grant select on public.auditoria_seguimiento to authenticated;
drop policy if exists mr_audit_read on public.auditoria_seguimiento;
create policy mr_audit_read on public.auditoria_seguimiento for select to authenticated using(public.mr_access(false));
create or replace function public.auditar_seguimiento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.auditoria_seguimiento(usuario,tabla,accion,registro_id,antes,despues)
  values(auth.uid(),tg_table_name,tg_op,coalesce(new.id,old.id)::text,case when tg_op <> 'INSERT' then to_jsonb(old) end,case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new,old);
end $$;
drop trigger if exists auditar_seguimiento on public.eventos_historial;
create trigger auditar_seguimiento after insert or update or delete on public.eventos_historial for each row execute function public.auditar_seguimiento();
drop trigger if exists auditar_seguimiento on public.actualizaciones_evento;
create trigger auditar_seguimiento after insert or update or delete on public.actualizaciones_evento for each row execute function public.auditar_seguimiento();

create or replace function public.importar_seguimiento_piloto(registros jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare r jsonb; e jsonb; a jsonb; eid uuid; n integer := 0;
begin
  if not public.mr_access(true) then raise exception 'Sin permisos de importación.'; end if;
  if jsonb_typeof(registros) <> 'array' or jsonb_array_length(registros) > 5000 then raise exception 'Archivo inválido o demasiado grande.'; end if;
  -- Serializes imports so duplicate checks and writes are atomic.
  perform pg_advisory_xact_lock(20260927);
  for r in select value from jsonb_array_elements(registros) loop
    e := r->'event';
    if nullif(e->'metadata'->>'pilotSourceId','') is null then raise exception 'Falta identificador de origen.'; end if;
    if exists(select 1 from public.eventos_historial where metadata->>'pilotSourceId' = e->'metadata'->>'pilotSourceId') then continue; end if;
    if exists(select 1 from public.eventos_historial where locomotora_codigo = e->>'locomotoraCodigo' and fecha = (e->>'fecha')::date and tipo = e->>'tipo' and not coalesce(anulado,false) and not (metadata ? 'pilotSourceId')) then raise exception 'Posible duplicado del historial: revisar antes de importar.'; end if;
    insert into public.eventos_historial(locomotora_codigo,fecha,hora,tipo,preventivo_codigo,titulo,descripcion,responsable,especialidad,criticidad,origen,estado_mantenimiento,fecha_cierre,hora_cierre,metadata)
    values(e->>'locomotoraCodigo',(e->>'fecha')::date,(e->>'hora')::time,e->>'tipo',nullif(e->>'preventivoCodigo',''),e->>'titulo',e->>'descripcion',e->>'responsable',e->>'especialidad','baja','manual',e->>'estadoMantenimiento',nullif(e->>'fechaCierre','')::date,nullif(e->>'horaCierre','')::time,e->'metadata') returning id into eid;
    for a in select value from jsonb_array_elements(r->'actualizaciones') loop
      insert into public.actualizaciones_evento(evento_id,fecha,hora,tipo_actualizacion,descripcion,responsable,metadata)
      values(eid,(a->>'fecha')::date,(a->>'hora')::time,'observacion',a->>'descripcion',a->>'responsable',a->'metadata');
    end loop;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.importar_seguimiento_piloto(jsonb) from public;
grant execute on function public.importar_seguimiento_piloto(jsonb) to authenticated;
create or replace function public.seguimiento_version()
returns integer language sql stable security invoker set search_path = public as $$
  select case when public.mr_access(false) then 1 else null end;
$$;
revoke all on function public.seguimiento_version() from public;
grant execute on function public.seguimiento_version() to authenticated;
commit;
