-- One area per new trip. Existing trips remain intact until their owner chooses one.
alter table public.itineraries
  add column area_id uuid references public.areas(id) on delete restrict;
create index itineraries_area on public.itineraries(area_id);

alter function private.plan_itinerary(uuid,integer,text,jsonb)
  rename to plan_itinerary_before_area;
revoke all on function private.plan_itinerary_before_area(uuid,integer,text,jsonb)
  from public,anon,authenticated,service_role;

create function private.plan_itinerary(trip_id uuid,expected_version integer,action text,payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); t public.itineraries; selected_area uuid; result_id uuid;
begin
  if uid is null or not private.has_premium() then
    raise insufficient_privilege using message='Explorer+ required';
  end if;
  if action='create' then
    selected_area=nullif(payload->>'area_id','')::uuid;
    if selected_area is null or not exists(select 1 from public.areas where id=selected_area) then
      raise exception 'Choose one area for your trip.' using errcode='PT422';
    end if;
    result_id=private.plan_itinerary_before_area(trip_id,expected_version,action,payload);
    update public.itineraries set area_id=selected_area where id=result_id;
    return result_id;
  end if;
  select * into t from public.itineraries where id=trip_id and user_id=uid for update;
  if t.id is null then raise exception 'Trip not found' using errcode='P0002'; end if;
  if expected_version is null or expected_version<>t.version then
    raise exception 'Plan changed; reload before editing' using errcode='40001';
  end if;
  if action='update' and payload ? 'area_id' then
    selected_area=nullif(payload->>'area_id','')::uuid;
    if selected_area is null or not exists(select 1 from public.areas where id=selected_area) then
      raise exception 'Choose one area for your trip.' using errcode='PT422';
    end if;
    if exists(select 1 from public.itinerary_items i where i.itinerary_id=t.id
      and not exists(select 1 from public.place_areas a where a.place_id=i.place_id and a.area_id=selected_area)) then
      raise exception 'Remove destinations outside this area before changing your trip area.' using errcode='PT422';
    end if;
    update public.itineraries set area_id=selected_area where id=t.id;
  elsif action='add' then
    if t.area_id is null then
      raise exception 'Choose an area in Edit trip before adding destinations.' using errcode='PT422';
    end if;
    if not exists(select 1 from public.place_areas where place_id=(payload->>'place_id')::uuid and area_id=t.area_id) then
      raise exception 'Choose a destination in your trip area.' using errcode='PT422';
    end if;
  end if;
  return private.plan_itinerary_before_area(trip_id,expected_version,action,payload);
end $$;
revoke all on function private.plan_itinerary(uuid,integer,text,jsonb) from public,anon;
grant execute on function private.plan_itinerary(uuid,integer,text,jsonb) to authenticated,service_role;
