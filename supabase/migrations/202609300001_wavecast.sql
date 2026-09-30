create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  station_uuid text not null,
  station_name text not null,
  station_favicon text not null default '',
  station_url text not null check (station_url like 'https://%'),
  created_at timestamptz not null default now(),
  unique (user_id, station_uuid)
);

create table public.recently_played (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  station_uuid text not null,
  station_name text not null,
  station_favicon text not null default '',
  station_url text not null check (station_url like 'https://%'),
  created_at timestamptz not null default now(),
  played_at timestamptz not null default now(),
  unique (user_id, station_uuid)
);

create index favorites_user_created on public.favorites (user_id, created_at desc);
create index recently_played_user_played on public.recently_played (user_id, played_at desc);

alter table public.favorites enable row level security;
alter table public.recently_played enable row level security;

create policy "Read own favorites" on public.favorites
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own favorites" on public.favorites
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own favorites" on public.favorites
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Delete own favorites" on public.favorites
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Read own history" on public.recently_played
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Delete own history" on public.recently_played
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.favorites from anon, authenticated;
revoke all on public.recently_played from anon, authenticated;
grant select, insert, update, delete on public.favorites to authenticated;
grant select, delete on public.recently_played to authenticated;

create or replace function public.record_recent_station(
  p_station_uuid text,
  p_station_name text,
  p_station_favicon text,
  p_station_url text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_station_url is null or p_station_url not like 'https://%' then
    raise exception 'HTTPS station URL required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller::text, 0));

  insert into public.recently_played (user_id, station_uuid, station_name, station_favicon, station_url, played_at)
  values (caller, p_station_uuid, p_station_name, coalesce(p_station_favicon, ''), p_station_url, clock_timestamp())
  on conflict (user_id, station_uuid) do update set
    station_name = excluded.station_name,
    station_favicon = excluded.station_favicon,
    station_url = excluded.station_url,
    played_at = excluded.played_at;

  delete from public.recently_played
  where user_id = caller and id in (
    select id from public.recently_played where user_id = caller
    order by played_at desc, id desc offset 20
  );
end;
$$;

revoke all on function public.record_recent_station(text, text, text, text) from public, anon;
grant execute on function public.record_recent_station(text, text, text, text) to authenticated;