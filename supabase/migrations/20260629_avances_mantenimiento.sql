-- MR CONTROL: avances de mantenimiento
begin;

alter table public.eventos_historial
  add column if not exists estado_mantenimiento text,
  add column if not exists estado_unidad_resultante text,
  add column if not exists fecha_cierre date,
  add column if not exists hora_cierre time,
  add column if not exists ultima_actividad_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'eventos_estado_mantenimiento_valido'
      and conrelid = 'public.eventos_historial'::regclass
  ) then
    alter table public.eventos_historial
      add constraint eventos_estado_mantenimiento_valido
      check (
        estado_mantenimiento is null
        or estado_mantenimiento in (
          'abierto','en_curso','pausado','finalizado','cancelado'
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'eventos_estado_unidad_resultante_valido'
      and conrelid = 'public.eventos_historial'::regclass
  ) then
    alter table public.eventos_historial
      add constraint eventos_estado_unidad_resultante_valido
      check (
        estado_unidad_resultante is null
        or estado_unidad_resultante in (
          'servicio',
          'uso_excepcional',
          'fuera_de_servicio',
          'disponible_con_observaciones',
          'pendiente_de_prueba'
        )
      );
  end if;
end
$$;

update public.eventos_historial
set
  estado_mantenimiento = coalesce(estado_mantenimiento, 'abierto'),
  ultima_actividad_at = coalesce(ultima_actividad_at, updated_at, created_at, now())
where tipo in ('preventivo', 'correctivo');

create table if not exists public.actualizaciones_evento (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null
    references public.eventos_historial(id)
    on delete cascade,
  fecha date not null,
  hora time,
  tipo_actualizacion text not null default 'avance',
  descripcion text not null,
  responsable text,
  porcentaje_avance smallint,
  estado_resultante text,
  motivo_pausa text,
  motivo_reapertura text,
  resultado_prueba text,
  estado_unidad_resultante text,
  pendientes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint actualizacion_tipo_valido
    check (
      tipo_actualizacion in (
        'avance','pausa','reanudacion','cierre','observacion','reapertura'
      )
    ),
  constraint actualizacion_porcentaje_valido
    check (
      porcentaje_avance is null
      or porcentaje_avance between 0 and 100
    ),
  constraint actualizacion_estado_valido
    check (
      estado_resultante is null
      or estado_resultante in (
        'abierto','en_curso','pausado','finalizado','cancelado'
      )
    ),
  constraint actualizacion_estado_unidad_valido
    check (
      estado_unidad_resultante is null
      or estado_unidad_resultante in (
        'servicio',
        'uso_excepcional',
        'fuera_de_servicio',
        'disponible_con_observaciones',
        'pendiente_de_prueba'
      )
    ),
  constraint actualizacion_metadata_es_objeto
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists actualizaciones_evento_evento_fecha_idx
on public.actualizaciones_evento (
  evento_id,
  fecha asc,
  hora asc,
  created_at asc
);

alter table public.adjuntos_evento
  add column if not exists actualizacion_id uuid
    references public.actualizaciones_evento(id)
    on delete cascade;

create index if not exists adjuntos_evento_actualizacion_id_idx
on public.adjuntos_evento (actualizacion_id);

create or replace function public.validar_actualizacion_mantenimiento()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tipo text;
begin
  select tipo into v_tipo
  from public.eventos_historial
  where id = new.evento_id;

  if v_tipo is null then
    raise exception 'El evento principal no existe';
  end if;

  if v_tipo not in ('preventivo', 'correctivo') then
    raise exception 'Solo los eventos preventivos y correctivos admiten avances';
  end if;

  return new;
end;
$$;

drop trigger if exists validar_tipo_actualizacion_evento
on public.actualizaciones_evento;

create trigger validar_tipo_actualizacion_evento
before insert or update
on public.actualizaciones_evento
for each row
execute function public.validar_actualizacion_mantenimiento();

create or replace function public.actualizaciones_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists actualizaciones_evento_set_updated_at
on public.actualizaciones_evento;

create trigger actualizaciones_evento_set_updated_at
before update
on public.actualizaciones_evento
for each row
execute function public.actualizaciones_set_updated_at();

create or replace function public.recalcular_estado_mantenimiento(p_evento_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_estado text;
  v_fecha_estado date;
  v_hora_estado time;
  v_estado_unidad text;
  v_ultima_actividad timestamptz;
begin
  select a.estado_resultante, a.fecha, a.hora
  into v_estado, v_fecha_estado, v_hora_estado
  from public.actualizaciones_evento a
  where a.evento_id = p_evento_id
    and a.estado_resultante is not null
  order by a.fecha desc, a.hora desc nulls last, a.created_at desc
  limit 1;

  select a.estado_unidad_resultante
  into v_estado_unidad
  from public.actualizaciones_evento a
  where a.evento_id = p_evento_id
    and a.estado_unidad_resultante is not null
  order by a.fecha desc, a.hora desc nulls last, a.created_at desc
  limit 1;

  select max(greatest(a.created_at, a.updated_at))
  into v_ultima_actividad
  from public.actualizaciones_evento a
  where a.evento_id = p_evento_id;

  update public.eventos_historial
  set
    estado_mantenimiento = coalesce(v_estado, 'abierto'),
    estado_unidad_resultante = v_estado_unidad,
    fecha_cierre = case
      when v_estado in ('finalizado', 'cancelado') then v_fecha_estado
      else null
    end,
    hora_cierre = case
      when v_estado in ('finalizado', 'cancelado') then v_hora_estado
      else null
    end,
    ultima_actividad_at = coalesce(
      v_ultima_actividad,
      updated_at,
      created_at,
      now()
    ),
    updated_at = now()
  where id = p_evento_id
    and tipo in ('preventivo', 'correctivo');
end;
$$;

create or replace function public.recalcular_mantenimiento_trigger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_estado_mantenimiento(old.evento_id);
    return old;
  end if;

  if tg_op = 'UPDATE'
     and old.evento_id is distinct from new.evento_id then
    perform public.recalcular_estado_mantenimiento(old.evento_id);
  end if;

  perform public.recalcular_estado_mantenimiento(new.evento_id);
  return new;
end;
$$;

drop trigger if exists recalcular_mantenimiento_por_actualizacion
on public.actualizaciones_evento;

create trigger recalcular_mantenimiento_por_actualizacion
after insert or update or delete
on public.actualizaciones_evento
for each row
execute function public.recalcular_mantenimiento_trigger();

alter table public.actualizaciones_evento enable row level security;

grant select, insert, update, delete
on public.actualizaciones_evento
to anon, authenticated;

drop policy if exists "desarrollo leer actualizaciones"
on public.actualizaciones_evento;
create policy "desarrollo leer actualizaciones"
on public.actualizaciones_evento
for select to anon, authenticated
using (true);

drop policy if exists "desarrollo crear actualizaciones"
on public.actualizaciones_evento;
create policy "desarrollo crear actualizaciones"
on public.actualizaciones_evento
for insert to anon, authenticated
with check (true);

drop policy if exists "desarrollo modificar actualizaciones"
on public.actualizaciones_evento;
create policy "desarrollo modificar actualizaciones"
on public.actualizaciones_evento
for update to anon, authenticated
using (true)
with check (true);

drop policy if exists "desarrollo eliminar actualizaciones"
on public.actualizaciones_evento;
create policy "desarrollo eliminar actualizaciones"
on public.actualizaciones_evento
for delete to anon, authenticated
using (true);

commit;
