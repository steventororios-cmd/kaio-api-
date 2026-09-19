-- Aventuras Tour Medellín CRM — esquema inicial
-- Single-tenant. Todo el acceso de la app pasa por el cliente server-side
-- con la service_role key (ver crm/lib/supabase/server.ts), que ignora RLS.
-- RLS se deja habilitado sin políticas permisivas: bloquea por defecto
-- cualquier acceso directo con las claves anon/publishable.

create extension if not exists "pgcrypto";

create type channel_type as enum ('whatsapp','instagram','messenger','internal');
create type message_direction as enum ('inbound','outbound');
create type sender_type_enum as enum ('contact','agent_ai','agent_human','system');
create type content_type_enum as enum ('text','audio','image','video','document','sticker','location','template');
create type tour_media_source as enum ('catalog','ai_generated');

-- ── Contactos ────────────────────────────────────────────────
create table contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  phone text,
  email text,
  city text,
  country text default 'Colombia',
  preferred_language text not null default 'es',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_contacted_at timestamptz
);

create table contact_channels (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  channel channel_type not null,
  external_id text not null,
  display_name text,
  created_at timestamptz not null default now(),
  unique (channel, external_id)
);
create index contact_channels_contact_id_idx on contact_channels (contact_id);

-- ── Conversaciones y mensajes ────────────────────────────────
create table conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  channel channel_type not null,
  status text not null default 'open',
  ai_enabled boolean not null default true,
  assigned_to uuid,
  deal_id uuid,
  unread_count int not null default 0,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (contact_id, channel)
);
create index conversations_last_message_idx on conversations (last_message_at desc nulls last);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction message_direction not null,
  channel channel_type not null,
  external_message_id text,
  sender_type sender_type_enum not null,
  content_type content_type_enum not null default 'text',
  text_body text,
  media_storage_path text,
  media_mime_type text,
  transcript text,
  vision_analysis jsonb,
  raw_payload jsonb,
  status text not null default 'received',
  ai_processed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (channel, external_message_id)
);
create index messages_conversation_created_idx on messages (conversation_id, created_at);

-- ── Pipeline de ventas ───────────────────────────────────────
create table pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int not null,
  is_won boolean not null default false,
  is_lost boolean not null default false
);

-- ── Catálogo de tours ────────────────────────────────────────
create table tours (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text,
  tag text,
  description text,
  price_cop numeric,
  price_unit text,
  duration text,
  schedule_text text,
  pickup_text text,
  includes jsonb not null default '[]',
  highlights jsonb not null default '[]',
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tour_media (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references tours(id) on delete cascade,
  storage_path text not null,
  caption text,
  is_primary boolean not null default false,
  source tour_media_source not null default 'catalog',
  created_at timestamptz not null default now()
);
create index tour_media_tour_id_idx on tour_media (tour_id);

-- ── Deals ────────────────────────────────────────────────────
create table deals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  tour_id uuid references tours(id),
  stage_id uuid not null references pipeline_stages(id),
  title text,
  value_cop numeric,
  pax int,
  tour_date date,
  source channel_type,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
create index deals_stage_idx on deals (stage_id);
create index deals_contact_idx on deals (contact_id);

alter table conversations
  add constraint conversations_deal_fk foreign key (deal_id) references deals(id) on delete set null;

-- ── Tareas y notas ───────────────────────────────────────────
create table tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  deal_id uuid references deals(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  title text not null,
  description text,
  due_at timestamptz,
  status text not null default 'pending',
  created_by text not null default 'owner',
  created_at timestamptz not null default now()
);
create index tasks_due_idx on tasks (due_at) where status = 'pending';

create table notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  deal_id uuid references deals(id) on delete cascade,
  body text not null,
  author text not null default 'owner',
  created_at timestamptz not null default now()
);

-- ── Tags ─────────────────────────────────────────────────────
create table tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  color text not null default '#64748b'
);

create table contact_tags (
  contact_id uuid not null references contacts(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (contact_id, tag_id)
);

-- ── Configuración del agente de IA ───────────────────────────
create table agent_settings (
  id boolean primary key default true check (id),
  system_prompt text not null default '',
  model text not null default 'gpt-4o',
  temperature numeric not null default 0.4,
  autonomous_enabled boolean not null default true,
  business_hours jsonb,
  updated_at timestamptz not null default now()
);

-- ── Auditoría ────────────────────────────────────────────────
create table events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor text not null,
  contact_id uuid references contacts(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index events_created_idx on events (created_at desc);

-- ── RLS: habilitado, sin políticas permisivas (deny-by-default para las
--    claves anon/publishable; el service_role del servidor las ignora) ──
alter table contacts enable row level security;
alter table contact_channels enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table pipeline_stages enable row level security;
alter table tours enable row level security;
alter table tour_media enable row level security;
alter table deals enable row level security;
alter table tasks enable row level security;
alter table notes enable row level security;
alter table tags enable row level security;
alter table contact_tags enable row level security;
alter table agent_settings enable row level security;
alter table events enable row level security;

-- ── Datos por defecto ────────────────────────────────────────
insert into pipeline_stages (name, position, is_won, is_lost) values
  ('Nuevo lead', 1, false, false),
  ('Contactado', 2, false, false),
  ('Calificado', 3, false, false),
  ('Propuesta enviada', 4, false, false),
  ('Negociación', 5, false, false),
  ('Ganado', 6, true, false),
  ('Perdido', 7, false, true);

insert into agent_settings (id, system_prompt, model, temperature, autonomous_enabled) values (
  true,
  'Eres el agente de ventas de Aventuras Tour Medellín, una agencia de tours en Medellín y Antioquia, Colombia. '
  || 'Eres un closer experto en turismo: cálido, cercano, resolutivo, y muy bueno manejando objeciones de precio y '
  || 'disponibilidad. Respondes siempre en español (a menos que el lead escriba en otro idioma). '
  || 'Solo puedes citar precios, horarios e inclusiones que aparezcan en el catálogo de tours que se te entrega en '
  || 'el contexto de cada conversación — nunca inventes un precio o una fecha. Si no tienes la información, dilo y '
  || 'ofrece agendar un seguimiento o escalar a un humano en vez de adivinar. Tu objetivo es avanzar la conversación '
  || 'hacia una reserva confirmada.',
  'gpt-4o',
  0.4,
  true
);
