CREATE OR REPLACE FUNCTION public.validar_seguimiento_integrado()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
    if new.fecha = d and new.tipo_actualizacion <> 'cierre' and parent.estado_mantenimiento <> 'finalizado' and coalesce(t->>'dayComplete','false') <> 'true' then raise exception 'El día sigue en curso.'; end if;
  end if;
  if coalesce((t->>'fullDay')::boolean,false) then
    if t->>'activity' <> 'espera' or t->>'period' <> 'Día completo' then raise exception 'Revisá el período del día completo.'; end if;
    if new.fecha = d and new.tipo_actualizacion <> 'cierre' and parent.estado_mantenimiento <> 'finalizado' and coalesce(t->>'dayComplete','false') <> 'true' then raise exception 'Hoy sigue en curso.'; end if;
  end if;
  if exists(select 1 from public.actualizaciones_evento a where a.evento_id = new.evento_id and a.id <> new.id and a.fecha = new.fecha and
    ((t->>'activity' in ('trabajo','mixto') and a.metadata->'seguimiento'->>'activity' = 'espera' and a.metadata->'seguimiento'->>'fullDay' = 'true') or
     (t->>'activity' = 'espera' and t->>'fullDay' = 'true' and a.metadata->'seguimiento'->>'activity' in ('trabajo','mixto')))) then raise exception 'El trabajo contradice una espera de día completo.'; end if;
  return new;
end $function$
;
