-- Selfmade Cloud Storage for Supabase
-- Apply this migration once in a dedicated Supabase project.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.selfmade_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.selfmade_households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.selfmade_household_members (
  household_id uuid not null references public.selfmade_households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.selfmade_household_states (
  household_id uuid primary key references public.selfmade_households(id) on delete cascade,
  data jsonb not null default '{"version":3,"tables":{}}'::jsonb,
  version bigint not null default 1 check (version > 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint selfmade_state_is_object check (jsonb_typeof(data) = 'object')
);

create index if not exists selfmade_members_user_idx
  on public.selfmade_household_members(user_id, household_id);
create index if not exists selfmade_households_owner_idx
  on public.selfmade_households(owner_id);
create index if not exists selfmade_states_updated_idx
  on public.selfmade_household_states(updated_at desc);

create or replace function private.selfmade_is_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.selfmade_household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = (select auth.uid())
  );
$$;

create or replace function private.selfmade_is_admin(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.selfmade_household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = (select auth.uid())
      and hm.role in ('owner', 'admin')
  );
$$;

grant execute on function private.selfmade_is_member(uuid) to authenticated;
grant execute on function private.selfmade_is_admin(uuid) to authenticated;

alter table public.selfmade_profiles enable row level security;
alter table public.selfmade_households enable row level security;
alter table public.selfmade_household_members enable row level security;
alter table public.selfmade_household_states enable row level security;

-- Drop and recreate policies so this migration is safely re-runnable.
drop policy if exists selfmade_profiles_select_own on public.selfmade_profiles;
drop policy if exists selfmade_profiles_insert_own on public.selfmade_profiles;
drop policy if exists selfmade_profiles_update_own on public.selfmade_profiles;
create policy selfmade_profiles_select_own
  on public.selfmade_profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy selfmade_profiles_insert_own
  on public.selfmade_profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy selfmade_profiles_update_own
  on public.selfmade_profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists selfmade_households_select_member on public.selfmade_households;
drop policy if exists selfmade_households_insert_owner on public.selfmade_households;
drop policy if exists selfmade_households_update_admin on public.selfmade_households;
drop policy if exists selfmade_households_delete_owner on public.selfmade_households;
create policy selfmade_households_select_member
  on public.selfmade_households for select to authenticated
  using ((select private.selfmade_is_member(id)));
create policy selfmade_households_insert_owner
  on public.selfmade_households for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy selfmade_households_update_admin
  on public.selfmade_households for update to authenticated
  using ((select private.selfmade_is_admin(id)))
  with check ((select private.selfmade_is_admin(id)));
create policy selfmade_households_delete_owner
  on public.selfmade_households for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists selfmade_members_select_member on public.selfmade_household_members;
drop policy if exists selfmade_members_insert_admin on public.selfmade_household_members;
drop policy if exists selfmade_members_update_admin on public.selfmade_household_members;
drop policy if exists selfmade_members_delete_admin_or_self on public.selfmade_household_members;
create policy selfmade_members_select_member
  on public.selfmade_household_members for select to authenticated
  using ((select private.selfmade_is_member(household_id)));
create policy selfmade_members_insert_admin
  on public.selfmade_household_members for insert to authenticated
  with check ((select private.selfmade_is_admin(household_id)));
create policy selfmade_members_update_admin
  on public.selfmade_household_members for update to authenticated
  using ((select private.selfmade_is_admin(household_id)))
  with check ((select private.selfmade_is_admin(household_id)));
create policy selfmade_members_delete_admin_or_self
  on public.selfmade_household_members for delete to authenticated
  using ((select private.selfmade_is_admin(household_id)) or user_id = (select auth.uid()));

drop policy if exists selfmade_states_select_member on public.selfmade_household_states;
create policy selfmade_states_select_member
  on public.selfmade_household_states for select to authenticated
  using ((select private.selfmade_is_member(household_id)));

-- State writes are performed through the optimistic-locking RPC below.
revoke insert, update, delete on public.selfmade_household_states from anon, authenticated;

grant select, insert, update on public.selfmade_profiles to authenticated;
grant select, insert, update, delete on public.selfmade_households to authenticated;
grant select, insert, update, delete on public.selfmade_household_members to authenticated;
grant select on public.selfmade_household_states to authenticated;

create or replace function public.selfmade_bootstrap(
  p_display_name text,
  p_household_name text,
  p_initial_state jsonb
)
returns table (
  household_id uuid,
  household_name text,
  state_version bigint,
  state_data jsonb,
  state_updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_household_name text;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  insert into public.selfmade_profiles (id, display_name, updated_at)
  values (v_user_id, left(coalesce(nullif(trim(p_display_name), ''), 'Selfmade'), 80), now())
  on conflict on constraint selfmade_profiles_pkey do update
    set display_name = excluded.display_name,
        updated_at = now();

  select hm.household_id, h.name
    into v_household_id, v_household_name
  from public.selfmade_household_members hm
  join public.selfmade_households h on h.id = hm.household_id
  where hm.user_id = v_user_id
  order by hm.created_at asc
  limit 1;

  if v_household_id is null then
    insert into public.selfmade_households (name, owner_id)
    values (left(coalesce(nullif(trim(p_household_name), ''), 'Mein Haushalt'), 80), v_user_id)
    returning selfmade_households.id, selfmade_households.name
      into v_household_id, v_household_name;

    insert into public.selfmade_household_members (household_id, user_id, role)
    values (v_household_id, v_user_id, 'owner');
  end if;

  insert into public.selfmade_household_states (household_id, data, version, updated_by)
  values (
    v_household_id,
    case when jsonb_typeof(p_initial_state) = 'object' then p_initial_state else '{"version":3,"tables":{}}'::jsonb end,
    1,
    v_user_id
  )
  on conflict on constraint selfmade_household_states_pkey do nothing;

  return query
    select h.id, h.name, s.version, s.data, s.updated_at
    from public.selfmade_households h
    join public.selfmade_household_states s on s.household_id = h.id
    where h.id = v_household_id;
end;
$$;

create or replace function public.selfmade_update_state(
  p_household_id uuid,
  p_expected_version bigint,
  p_state jsonb
)
returns table (
  state_version bigint,
  state_updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.selfmade_household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = v_user_id
  ) then
    raise exception 'household_access_denied' using errcode = '42501';
  end if;

  if jsonb_typeof(p_state) <> 'object' then
    raise exception 'invalid_state' using errcode = '22023';
  end if;

  return query
    update public.selfmade_household_states s
       set data = p_state,
           version = s.version + 1,
           updated_by = v_user_id,
           updated_at = now()
     where s.household_id = p_household_id
       and s.version = p_expected_version
    returning s.version, s.updated_at;

  if not found then
    raise exception 'version_conflict' using errcode = '40001';
  end if;
end;
$$;

grant execute on function public.selfmade_bootstrap(text, text, jsonb) to authenticated;
grant execute on function public.selfmade_update_state(uuid, bigint, jsonb) to authenticated;

-- Include state updates in Supabase Realtime Postgres Changes.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'selfmade_household_states'
  ) then
    alter publication supabase_realtime add table public.selfmade_household_states;
  end if;
end $$;
