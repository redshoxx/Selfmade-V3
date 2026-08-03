-- Selfmade V15 – privater Kassenbon-Speicher
-- Nicht destruktiv: bestehende V14-Snapshots und Nutzer bleiben unverändert.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'selfmade-receipts',
  'selfmade-receipts',
  false,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.selfmade_storage_household(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

revoke all on function private.selfmade_storage_household(text) from public;
grant execute on function private.selfmade_storage_household(text) to authenticated;

drop policy if exists selfmade_receipts_select_member on storage.objects;
drop policy if exists selfmade_receipts_insert_member on storage.objects;
drop policy if exists selfmade_receipts_update_member on storage.objects;
drop policy if exists selfmade_receipts_delete_member on storage.objects;

create policy selfmade_receipts_select_member
on storage.objects for select to authenticated
using (
  bucket_id = 'selfmade-receipts'
  and private.selfmade_is_member(private.selfmade_storage_household(name))
);

create policy selfmade_receipts_insert_member
on storage.objects for insert to authenticated
with check (
  bucket_id = 'selfmade-receipts'
  and private.selfmade_is_member(private.selfmade_storage_household(name))
);

create policy selfmade_receipts_update_member
on storage.objects for update to authenticated
using (
  bucket_id = 'selfmade-receipts'
  and private.selfmade_is_member(private.selfmade_storage_household(name))
)
with check (
  bucket_id = 'selfmade-receipts'
  and private.selfmade_is_member(private.selfmade_storage_household(name))
);

create policy selfmade_receipts_delete_member
on storage.objects for delete to authenticated
using (
  bucket_id = 'selfmade-receipts'
  and private.selfmade_is_member(private.selfmade_storage_household(name))
);

-- Realtime bleibt auf dem bestehenden Snapshot-Datensatz aktiv.
alter table public.selfmade_household_states replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'selfmade_household_states'
  ) then
    alter publication supabase_realtime add table public.selfmade_household_states;
  end if;
end $$;
