create table if not exists public.juridico_office (
  id text primary key,
  studio text default '',
  lawyer text default '',
  role text default '',
  email text default '',
  colegiado text default '',
  accent text default '#1a4fa0'
);

create table if not exists public.juridico_clients (
  id text primary key,
  nombre text not null,
  email text default '',
  telefono text default '',
  rut text default '',
  notas text default '',
  color text default '#1a4fa0',
  updated_at timestamptz default now()
);

create table if not exists public.juridico_cases (
  id text primary key,
  nombre text not null,
  materia text default '',
  detalle text default '',
  cliente_id text references public.juridico_clients(id) on delete set null,
  contraparte text default '',
  tribunal text default '',
  rol text default '',
  estado text default 'prep',
  fecha text default '',
  resumen text default '',
  notas text default '',
  updated_at timestamptz default now()
);

create table if not exists public.juridico_documents (
  id text primary key,
  nombre text not null,
  caso_id text references public.juridico_cases(id) on delete cascade,
  tipo text default '',
  fecha text default '',
  tamano text default '',
  descripcion text default '',
  updated_at timestamptz default now()
);

create table if not exists public.juridico_tasks (
  id text primary key,
  nombre text not null,
  caso_id text references public.juridico_cases(id) on delete cascade,
  prioridad text default 'media',
  fecha text default '',
  done boolean default false,
  updated_at timestamptz default now()
);

create table if not exists public.juridico_events (
  id text primary key,
  titulo text not null,
  detalle text default '',
  caso_id text references public.juridico_cases(id) on delete cascade,
  fecha text default '',
  tipo text default '',
  updated_at timestamptz default now()
);

create table if not exists public.juridico_library (
  id text primary key,
  titulo text not null,
  tipo text default '',
  materia text default '',
  fuente text default '',
  estado text default '',
  nota text default '',
  updated_at timestamptz default now()
);

create table if not exists public.juridico_activity (
  id text primary key,
  mensaje text default '',
  at timestamptz default now()
);

alter table public.juridico_office disable row level security;
alter table public.juridico_clients disable row level security;
alter table public.juridico_cases disable row level security;
alter table public.juridico_documents disable row level security;
alter table public.juridico_tasks disable row level security;
alter table public.juridico_events disable row level security;
alter table public.juridico_library disable row level security;
alter table public.juridico_activity disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.juridico_office to anon, authenticated;
grant select, insert, update, delete on public.juridico_clients to anon, authenticated;
grant select, insert, update, delete on public.juridico_cases to anon, authenticated;
grant select, insert, update, delete on public.juridico_documents to anon, authenticated;
grant select, insert, update, delete on public.juridico_tasks to anon, authenticated;
grant select, insert, update, delete on public.juridico_events to anon, authenticated;
grant select, insert, update, delete on public.juridico_library to anon, authenticated;
grant select, insert, update, delete on public.juridico_activity to anon, authenticated;
