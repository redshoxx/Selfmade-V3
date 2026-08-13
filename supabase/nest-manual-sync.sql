create table if not exists public.nest_manual_sync (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  device_token_hash text not null,
  app_version text not null default '',
  payload jsonb not null,
  client_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists nest_manual_sync_synced_at_idx
  on public.nest_manual_sync (synced_at desc);

alter table public.nest_manual_sync enable row level security;

-- Absichtlich keine anon/authenticated Policies:
-- Die Tabelle ist nicht direkt aus der App erreichbar.
-- Nur die serverseitige Vercel-Funktion mit Service-Role-Key darf schreiben/lesen.
