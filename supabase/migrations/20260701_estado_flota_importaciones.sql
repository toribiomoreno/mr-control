-- MR CONTROL: estado diario de flota e importaciones de Patio
begin;

create table if not exists public.importaciones_estado_flota (
  id uuid primary key default gen_random_uuid(),
  fecha_hora_parte timestamptz not null,
  contenido_original text not null,
  cantidad_filas integer not null default 0,
  cantidad_validas integer not null default 0,
  cantidad_errores integer not null default 0,
  creado_en timestamptz not null default now()
);

create table if not exists public.estado_flota_actual (
  codigo text primary key,
  estado text not null,
  motivo text,
  clasificacion_detencion text,
  fecha_hora_parte timestamptz not null,
  actualizado_en timestamptz not null default now(),
  importacion_id uuid references public.importaciones_estado_flota(id) on delete set null,

  constraint estado_flota_actual_estado_valido
    check (estado in ('operativa', 'reserva', 'uso_excepcional', 'detenida')),
  constraint estado_flota_actual_clasificacion_valida
    check (
      clasificacion_detencion is null
      or clasificacion_detencion in ('preventivo', 'correctivo', 'sin_clasificar')
    )
);

create table if not exists public.historial_estados_flota (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  estado_anterior text,
  estado_nuevo text not null,
  motivo text,
  clasificacion_detencion text,
  fecha_hora_parte timestamptz not null,
  importacion_id uuid references public.importaciones_estado_flota(id) on delete set null,
  creado_en timestamptz not null default now(),

  constraint historial_estados_flota_estado_anterior_valido
    check (
      estado_anterior is null
      or estado_anterior in ('operativa', 'reserva', 'uso_excepcional', 'detenida')
    ),
  constraint historial_estados_flota_estado_nuevo_valido
    check (estado_nuevo in ('operativa', 'reserva', 'uso_excepcional', 'detenida')),
  constraint historial_estados_flota_clasificacion_valida
    check (
      clasificacion_detencion is null
      or clasificacion_detencion in ('preventivo', 'correctivo', 'sin_clasificar')
    )
);

create table if not exists public.actividades_calendario_patio (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  tipo text not null,
  origen text not null default 'patio',
  estado text not null default 'en_curso',
  fecha_inicio date not null,
  fecha_fin date,
  ultimo_parte_at timestamptz not null,
  motivo text,
  clasificacion_detencion text,
  preventivo_codigo text,
  importacion_inicio_id uuid references public.importaciones_estado_flota(id) on delete set null,
  importacion_ultimo_id uuid references public.importaciones_estado_flota(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint actividades_calendario_patio_tipo_valido
    check (tipo in ('preventivo', 'numeral', 'correctivo', 'detenida')),
  constraint actividades_calendario_patio_origen_valido
    check (origen = 'patio'),
  constraint actividades_calendario_patio_estado_valido
    check (estado in ('en_curso', 'cerrada')),
  constraint actividades_calendario_patio_clasificacion_valida
    check (
      clasificacion_detencion is null
      or clasificacion_detencion in ('preventivo', 'correctivo', 'sin_clasificar')
    )
);

create unique index if not exists actividades_calendario_patio_activa_unidad_idx
on public.actividades_calendario_patio (codigo)
where origen = 'patio' and estado = 'en_curso';

create index if not exists historial_estados_flota_codigo_parte_idx
on public.historial_estados_flota (codigo, fecha_hora_parte desc);

create index if not exists estado_flota_actual_estado_idx
on public.estado_flota_actual (estado);

commit;
