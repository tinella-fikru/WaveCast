create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique(id, user_id)
);
create index collections_user on public.collections(user_id, created_at);
create table public.collection_stations (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  station_uuid text not null,
  station_data jsonb not null check (station_data->>'url_resolved' like 'https://%' and station_data->>'stationuuid' = station_uuid),
  position integer not null default 0 check(position >= 0),
  created_at timestamptz not null default now(),
  foreign key(collection_id, user_id) references public.collections(id, user_id) on delete cascade,
  unique(collection_id, station_uuid)
);
create index collection_stations_order on public.collection_stations(collection_id, position);
alter table public.collections enable row level security;
alter table public.collection_stations enable row level security;
create policy "Own collections" on public.collections for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own collection stations" on public.collection_stations for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.collections, public.collection_stations from anon, authenticated;
grant select, insert, update, delete on public.collections to authenticated;
grant select, delete on public.collection_stations to authenticated;

create function public.add_collection_station(p_collection uuid, p_station jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); next_position integer;
begin
  if caller is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform 1 from public.collections where id=p_collection and user_id=caller for update;
  if not found then raise exception 'Collection unavailable' using errcode='42501'; end if;
  if coalesce(p_station->>'url_resolved','') not like 'https://%' or coalesce(p_station->>'stationuuid','') = '' then raise exception 'Invalid station'; end if;
  select coalesce(max(position),-1)+1 into next_position from public.collection_stations where collection_id=p_collection and user_id=caller;
  insert into public.collection_stations(collection_id,user_id,station_uuid,station_data,position)
    values(p_collection,caller,p_station->>'stationuuid',p_station,next_position) on conflict(collection_id,station_uuid) do nothing;
end; $$;

create function public.reorder_collection(p_collection uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform 1 from public.collections where id=p_collection and user_id=caller for update;
  if not found then raise exception 'Collection unavailable' using errcode='42501'; end if;
  if p_ids is null or cardinality(p_ids) <> (select count(*) from public.collection_stations where collection_id=p_collection and user_id=caller)
    or cardinality(p_ids) <> (select count(distinct value) from unnest(p_ids) as value)
    or exists(select 1 from unnest(p_ids) as value where not exists(select 1 from public.collection_stations where id=value and collection_id=p_collection and user_id=caller))
    then raise exception 'Collection changed; refresh and retry'; end if;
  update public.collection_stations as stations set position = ordering.ordinality-1
    from unnest(p_ids) with ordinality as ordering(id,ordinality)
    where stations.id=ordering.id and stations.collection_id=p_collection and stations.user_id=caller;
end; $$;
revoke all on function public.add_collection_station(uuid,jsonb), public.reorder_collection(uuid,uuid[]) from public, anon;
grant execute on function public.add_collection_station(uuid,jsonb), public.reorder_collection(uuid,uuid[]) to authenticated;

create table public.listening_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  station_uuid text not null,
  station_name text not null,
  country text not null default '',
  tags text not null default '',
  started_at timestamptz not null,
  ended_at timestamptz not null,
  seconds integer not null check(seconds between 1 and 86400),
  check(ended_at >= started_at)
);
create index listening_sessions_user_date on public.listening_sessions(user_id,started_at desc);
alter table public.listening_sessions enable row level security;
create policy "Read own listening sessions" on public.listening_sessions for select to authenticated using((select auth.uid())=user_id);
create policy "Delete own listening sessions" on public.listening_sessions for delete to authenticated using((select auth.uid())=user_id);
revoke all on public.listening_sessions from anon, authenticated;
grant select, delete on public.listening_sessions to authenticated;
create function public.record_listening_session(p_id uuid,p_station_uuid text,p_station_name text,p_country text,p_tags text,p_started_at timestamptz,p_seconds integer) returns void
language plpgsql security definer set search_path='' as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_seconds < 1 or p_seconds > 86400 or p_started_at > now() or p_started_at < now()-interval '2 days'
    or p_seconds > extract(epoch from now()-p_started_at)+5 then raise exception 'Invalid listening duration'; end if;
  insert into public.listening_sessions(id,user_id,station_uuid,station_name,country,tags,started_at,ended_at,seconds)
    values(p_id,caller,p_station_uuid,p_station_name,coalesce(p_country,''),coalesce(p_tags,''),p_started_at,now(),p_seconds)
    on conflict(id) do update set seconds=greatest(public.listening_sessions.seconds,excluded.seconds),ended_at=greatest(public.listening_sessions.ended_at,excluded.ended_at)
    where public.listening_sessions.user_id=caller and public.listening_sessions.station_uuid=p_station_uuid;
end; $$;
revoke all on function public.record_listening_session(uuid,text,text,text,text,timestamptz,integer) from public,anon;
grant execute on function public.record_listening_session(uuid,text,text,text,text,timestamptz,integer) to authenticated;