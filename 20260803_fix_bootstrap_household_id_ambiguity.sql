-- Hotfix for existing Selfmade Supabase installations.
-- Fixes: column reference "household_id" is ambiguous
-- Safe to run multiple times.

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
  values (
    v_user_id,
    left(coalesce(nullif(trim(p_display_name), ''), 'Selfmade'), 80),
    now()
  )
  on conflict on constraint selfmade_profiles_pkey do update
    set display_name = excluded.display_name,
        updated_at = now();

  select hm.household_id, h.name
    into v_household_id, v_household_name
  from public.selfmade_household_members as hm
  join public.selfmade_households as h
    on h.id = hm.household_id
  where hm.user_id = v_user_id
  order by hm.created_at asc
  limit 1;

  if v_household_id is null then
    insert into public.selfmade_households (name, owner_id)
    values (
      left(coalesce(nullif(trim(p_household_name), ''), 'Mein Haushalt'), 80),
      v_user_id
    )
    returning selfmade_households.id, selfmade_households.name
      into v_household_id, v_household_name;

    insert into public.selfmade_household_members (
      household_id,
      user_id,
      role
    )
    values (v_household_id, v_user_id, 'owner');
  end if;

  insert into public.selfmade_household_states (
    household_id,
    data,
    version,
    updated_by
  )
  values (
    v_household_id,
    case
      when jsonb_typeof(p_initial_state) = 'object' then p_initial_state
      else '{"version":3,"tables":{}}'::jsonb
    end,
    1,
    v_user_id
  )
  on conflict on constraint selfmade_household_states_pkey do nothing;

  return query
    select
      h.id,
      h.name,
      s.version,
      s.data,
      s.updated_at
    from public.selfmade_households as h
    join public.selfmade_household_states as s
      on s.household_id = h.id
    where h.id = v_household_id;
end;
$$;

grant execute on function public.selfmade_bootstrap(text, text, jsonb)
  to authenticated;
