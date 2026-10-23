begin;

-- Existing member_places remains the only Bucketlist / Visited store.
create table public.itineraries (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (length(btrim(title)) between 1 and 120),
 notes text not null default '' check (length(notes)<=5000),
 start_date date,
 end_date date,
 version integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check ((start_date is null and end_date is null) or
   (start_date is not null and end_date is not null and end_date>=start_date and end_date-start_date<60))
);
create index itineraries_owner on public.itineraries(user_id,updated_at desc);
create table public.itinerary_days (
 id uuid primary key default gen_random_uuid(),
 itinerary_id uuid not null references public.itineraries(id) on delete cascade,
 day_number integer not null check(day_number between 1 and 60),
 unique(itinerary_id,day_number), unique(id,itinerary_id)
);
create table public.itinerary_items (
 id uuid primary key default gen_random_uuid(),
 itinerary_id uuid not null references public.itineraries(id) on delete cascade,
 day_id uuid not null,
 place_id uuid not null references public.places(id) on delete restrict,
 position integer not null check(position>=0),
 notes text not null default '' check(length(notes)<=2000),
 foreign key(day_id,itinerary_id) references public.itinerary_days(id,itinerary_id) on delete cascade,
 unique(day_id,place_id),
 constraint itinerary_stop_order unique(day_id,position) deferrable initially deferred
);
create index itinerary_items_trip on public.itinerary_items(itinerary_id);
create index itinerary_items_place on public.itinerary_items(place_id);
alter table public.itineraries enable row level security;
alter table public.itinerary_days enable row level security;
alter table public.itinerary_items enable row level security;
revoke all on public.itineraries,public.itinerary_days,public.itinerary_items from anon,authenticated;
grant select on public.itineraries,public.itinerary_days,public.itinerary_items to authenticated;
grant all on public.itineraries,public.itinerary_days,public.itinerary_items to service_role;
create policy trip_owner on public.itineraries for select to authenticated using(user_id=(select auth.uid()));
create policy day_owner on public.itinerary_days for select to authenticated using(exists(select 1 from public.itineraries t where t.id=itinerary_id and t.user_id=(select auth.uid())));
create policy item_owner on public.itinerary_items for select to authenticated using(exists(select 1 from public.itineraries t where t.id=itinerary_id and t.user_id=(select auth.uid())));

-- All mutations serialize on the parent row. Version checks prevent a second tab
-- from overwriting a newer plan. Owner and Place access checks also apply to RPC callers.
create function private.plan_itinerary(trip_id uuid, expected_version integer, action text, payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); t public.itineraries; did uuid; iid uuid; source_day uuid;
 n integer; old_n integer; ids uuid[]; pid uuid; start_on date; end_on date;
begin
 if uid is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if action='create' then
   perform pg_advisory_xact_lock(hashtextextended(uid::text,207));
   if (select count(*) from public.itineraries where user_id=uid)>=100 then raise exception 'Trip limit reached' using errcode='22023'; end if;
   start_on=nullif(payload->>'start_date','')::date; end_on=nullif(payload->>'end_date','')::date;
   n=case when start_on is not null and end_on is not null then end_on-start_on+1 else coalesce((payload->>'day_count')::int,1) end;
   if n not between 1 and 60 then raise exception 'Choose 1 to 60 days' using errcode='22023'; end if;
   insert into public.itineraries(user_id,title,notes,start_date,end_date)
   values(uid,btrim(payload->>'title'),coalesce(payload->>'notes',''),start_on,end_on) returning * into t;
   insert into public.itinerary_days(itinerary_id,day_number) select t.id,generate_series(1,n);
   return t.id;
 end if;
 select * into t from public.itineraries where id=trip_id and user_id=uid for update;
 if t.id is null then raise exception 'Trip not found' using errcode='P0002'; end if;
 if expected_version is null or expected_version<>t.version then raise exception 'Plan changed; reload before editing' using errcode='40001'; end if;
 if action='delete' then delete from public.itineraries where id=t.id; return t.id; end if;
 if action='update' then
   start_on=nullif(payload->>'start_date','')::date; end_on=nullif(payload->>'end_date','')::date;
   n=case when start_on is not null and end_on is not null then end_on-start_on+1 else (payload->>'day_count')::int end;
   if n is null or n not between 1 and 60 then raise exception 'Choose 1 to 60 days' using errcode='22023'; end if;
   if exists(select 1 from public.itinerary_items i join public.itinerary_days d on d.id=i.day_id where d.itinerary_id=t.id and d.day_number>n) then
     raise exception 'Move or remove stops before shortening a trip' using errcode='23503'; end if;
   delete from public.itinerary_days where itinerary_id=t.id and day_number>n;
   insert into public.itinerary_days(itinerary_id,day_number) select t.id,generate_series(1,n) on conflict(itinerary_id,day_number) do nothing;
   update public.itineraries set title=btrim(payload->>'title'),notes=coalesce(payload->>'notes',''),start_date=start_on,end_date=end_on where id=t.id;
 elsif action='add_day' then
   select max(day_number) into old_n from public.itinerary_days where itinerary_id=t.id;
   if old_n>=60 then raise exception 'Trip limit is 60 days' using errcode='22023'; end if;
   insert into public.itinerary_days(itinerary_id,day_number) values(t.id,old_n+1);
   update public.itineraries set end_date=case when start_date is not null then start_date+old_n else null end where id=t.id;
 else
   did=(payload->>'day_id')::uuid;
   if did is not null and not exists(select 1 from public.itinerary_days where id=did and itinerary_id=t.id) then raise exception 'Day not found' using errcode='22023'; end if;
   if action='add' then
     pid=(payload->>'place_id')::uuid;
     if did is null or not private.can_view_place(pid) or not exists(select 1 from public.places where id=pid and status='publish') then raise exception 'Place unavailable' using errcode='42501'; end if;
     if (select count(*) from public.itinerary_items where day_id=did)>=50 then raise exception 'Day limit reached' using errcode='22023'; end if;
     insert into public.itinerary_items(itinerary_id,day_id,place_id,position)
       select t.id,did,pid,coalesce(max(position)+1,0) from public.itinerary_items where day_id=did;
   elsif action='reorder' then
     ids=array(select jsonb_array_elements_text(payload->'item_ids')::uuid);
     if did is null or cardinality(ids)<>(select count(*) from public.itinerary_items where day_id=did)
       or cardinality(ids)<>(select count(distinct x) from unnest(ids) x)
       or exists(select 1 from unnest(ids) x where not exists(select 1 from public.itinerary_items where id=x and day_id=did)) then
       raise exception 'Order must include every stop exactly once' using errcode='22023'; end if;
     update public.itinerary_items i set position=o.n-1 from unnest(ids) with ordinality o(id,n) where i.id=o.id and i.day_id=did;
   elsif action in ('remove','move','notes') then
     iid=(payload->>'item_id')::uuid;
     select day_id into source_day from public.itinerary_items where id=iid and itinerary_id=t.id;
     if source_day is null then raise exception 'Stop not found' using errcode='22023'; end if;
     if action='remove' then delete from public.itinerary_items where id=iid;
     elsif action='notes' then update public.itinerary_items set notes=coalesce(payload->>'notes','') where id=iid;
     else
       if did is null then raise exception 'Choose a day' using errcode='22023'; end if;
       if (select count(*) from public.itinerary_items where day_id=did)>=50 then raise exception 'Day limit reached' using errcode='22023'; end if;
       update public.itinerary_items set day_id=did,position=(select coalesce(max(position)+1,0) from public.itinerary_items where day_id=did) where id=iid;
     end if;
     with ordered as (select id,row_number() over(order by position)-1 n from public.itinerary_items where day_id=source_day)
     update public.itinerary_items i set position=o.n from ordered o where i.id=o.id;
   else raise exception 'Unknown operation' using errcode='22023'; end if;
 end if;
 update public.itineraries set version=version+1,updated_at=now() where id=t.id;
 return t.id;
end $$;
create function public.plan_itinerary(trip_id uuid,expected_version integer,action text,payload jsonb)
returns uuid language sql volatile security invoker set search_path='' as $$ select private.plan_itinerary($1,$2,$3,$4) $$;
revoke all on function private.plan_itinerary(uuid,integer,text,jsonb),public.plan_itinerary(uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function private.plan_itinerary(uuid,integer,text,jsonb),public.plan_itinerary(uuid,integer,text,jsonb) to authenticated;

-- New fields are optional verified facts. No legacy travel value is converted.
alter table public.place_details
 add column boat_required boolean not null default false,
 add column departure_port text check(length(departure_port)<=200),
 add column road_minutes numeric check(road_minutes between 0 and 100000),
 add column boat_minutes numeric check(boat_minutes between 0 and 100000),
 add column hike_minutes numeric check(hike_minutes between 0 and 100000),
 add column travel_notes text not null default '' check(length(travel_notes)<=5000),
 add column transport_minutes jsonb not null default '{}' check(jsonb_typeof(transport_minutes)='object');
create function private.valid_transport(value jsonb) returns boolean language sql immutable set search_path='' as $$
 select not exists(select 1 from jsonb_each(value) e where e.key not in ('Motorcycle','Car','4x4','Boat')
   or jsonb_typeof(e.value) not in ('number','null')
   or (jsonb_typeof(e.value)='number' and ((e.value::text)::numeric<0 or (e.value::text)::numeric>100000)))
$$;
revoke all on function private.valid_transport(jsonb) from public;
grant execute on function private.valid_transport(jsonb) to authenticated,service_role;
alter table public.place_details add constraint valid_transport_minutes check(private.valid_transport(transport_minutes));

alter function private.admin_save_place(uuid,jsonb) rename to admin_save_place_v1;
revoke all on function private.admin_save_place_v1(uuid,jsonb) from authenticated;
create function private.admin_save_place(pid uuid,body jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid;
begin
 if not private.is_staff() then raise exception 'MFA staff required' using errcode='42501'; end if;
 result_id=private.admin_save_place_v1(pid,body);
 if body ? 'boat_required' then
   update public.place_details set boat_required=(body->>'boat_required')::boolean,
    departure_port=nullif(body->>'departure_port',''),road_minutes=(body->>'road_minutes')::numeric,
    boat_minutes=(body->>'boat_minutes')::numeric,hike_minutes=(body->>'hike_minutes')::numeric,
    travel_notes=coalesce(body->>'travel_notes',''),transport_minutes=coalesce(body->'transport_minutes','{}') where place_id=result_id;
 end if;
 return result_id;
end $$;
-- Rebind the public wrapper: SQL bodies can retain the renamed function OID.
create or replace function public.admin_save_place(pid uuid,body jsonb) returns uuid language sql volatile security invoker set search_path='' as $$ select private.admin_save_place($1,$2) $$;
revoke all on function private.admin_save_place(uuid,jsonb) from public,anon;
grant execute on function private.admin_save_place(uuid,jsonb) to authenticated;

create table public.place_recommendations (
 source_place_id uuid not null references public.places(id) on delete cascade,
 recommended_place_id uuid not null references public.places(id) on delete cascade,
 position integer not null check(position between 0 and 11),
 recommendation_type text check(length(recommendation_type)<=80),
 primary key(source_place_id,recommended_place_id),
 unique(source_place_id,position) deferrable initially deferred,
 check(source_place_id<>recommended_place_id)
);
create index recommendations_target on public.place_recommendations(recommended_place_id);
alter table public.place_recommendations enable row level security;
revoke all on public.place_recommendations from anon,authenticated;
grant select on public.place_recommendations to anon,authenticated;
grant all on public.place_recommendations to service_role;
create policy recommendations_read on public.place_recommendations for select using(
 (select private.is_staff()) or (private.can_view_place(source_place_id) and private.can_view_place(recommended_place_id)
 and exists(select 1 from public.places where id=recommended_place_id and status='publish')));
create function private.save_recommendations(source_id uuid,items jsonb) returns void language plpgsql security definer set search_path='' as $$
declare item jsonb; n integer:=0;
begin
 if not private.is_staff() then raise exception 'MFA staff required' using errcode='42501'; end if;
 perform 1 from public.places where id=source_id for update;
 if not found then raise exception 'Place not found' using errcode='22023'; end if;
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items)>12 then raise exception 'Choose at most 12 recommendations' using errcode='22023'; end if;
 delete from public.place_recommendations where source_place_id=source_id;
 for item in select * from jsonb_array_elements(items) loop
   if not exists(select 1 from public.places where id=(item->>'place_id')::uuid and status='publish') then raise exception 'Publish the recommended place first' using errcode='22023'; end if;
   insert into public.place_recommendations values(source_id,(item->>'place_id')::uuid,n,nullif(item->>'type',''));n=n+1;
 end loop;
end $$;
create function public.save_recommendations(source_id uuid,items jsonb) returns void language sql volatile security invoker set search_path='' as $$ select private.save_recommendations($1,$2) $$;
revoke all on function public.save_recommendations(uuid,jsonb),private.save_recommendations(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_recommendations(uuid,jsonb),private.save_recommendations(uuid,jsonb) to authenticated;
create trigger recommendations_audit after insert or update or delete on public.place_recommendations for each row execute function private.audit_change();
commit;
