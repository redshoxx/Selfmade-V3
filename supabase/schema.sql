-- Selfmade V1 – neues, eigenständiges Datenschema.
-- Im Supabase SQL Editor des Projekts dpqhoesiniberglymdtb ausführen.
-- Es werden keine Alt-Tabellen gelöscht und keine Service-/Secret-Keys benötigt.

create table if not exists public.v1_records (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity text not null check (entity in (
    'shopping', 'pantry', 'recipe', 'meal', 'transaction',
    'savings', 'budget', 'note', 'challenge', 'member'
  )),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists v1_records_user_entity_idx
  on public.v1_records (user_id, entity, updated_at desc);

create index if not exists v1_records_user_live_idx
  on public.v1_records (user_id, updated_at desc)
  where deleted_at is null;

alter table public.v1_records enable row level security;

revoke all on table public.v1_records from anon;
grant select, insert, update, delete on table public.v1_records to authenticated;

create policy "v1_records_select_own"
  on public.v1_records
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "v1_records_insert_own"
  on public.v1_records
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "v1_records_update_own"
  on public.v1_records
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "v1_records_delete_own"
  on public.v1_records
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
