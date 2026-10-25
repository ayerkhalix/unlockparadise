-- Reordering destinations preserves each position's saved time slot. Notes remain
-- attached to their destination. The parent row lock serializes all trip edits.
alter function private.plan_itinerary(uuid,integer,text,jsonb) rename to plan_itinerary_before_time_slots;
revoke all on function private.plan_itinerary_before_time_slots(uuid,integer,text,jsonb) from public,anon,authenticated,service_role;

create function private.plan_itinerary(trip_id uuid,expected_version integer,action text,payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  t public.itineraries;
  did uuid;
  slots jsonb;
  result_id uuid;
begin
  if action <> 'reorder' then
    return private.plan_itinerary_before_time_slots(trip_id,expected_version,action,payload);
  end if;
  if uid is null or not private.has_premium() then
    raise insufficient_privilege using message='Explorer+ required';
  end if;
  select * into t from public.itineraries where id=trip_id and user_id=uid for update;
  if t.id is null then raise exception 'Trip not found' using errcode='P0002'; end if;
  if expected_version is null or expected_version <> t.version then
    raise exception 'Plan changed; reload before editing' using errcode='40001';
  end if;
  did := (payload->>'day_id')::uuid;
  select coalesce(jsonb_agg(jsonb_build_object('start',i.start_time,'end',i.end_time) order by i.position,i.id),'[]'::jsonb)
    into slots from public.itinerary_items i where i.itinerary_id=t.id and i.day_id=did;
  -- Canonical reorder validates day ownership and every item exactly once, then
  -- increments the version once. Any failure rolls back the entire transaction.
  result_id := private.plan_itinerary_before_time_slots(trip_id,expected_version,action,payload);
  update public.itinerary_items i
    set start_time=(slot.value->>'start')::time,end_time=(slot.value->>'end')::time
    from jsonb_array_elements(slots) with ordinality slot(value,n)
    where i.itinerary_id=t.id and i.day_id=did and i.position=slot.n-1;
  return result_id;
end $$;
revoke all on function private.plan_itinerary(uuid,integer,text,jsonb) from public,anon;
grant execute on function private.plan_itinerary(uuid,integer,text,jsonb) to authenticated,service_role;
create or replace function public.plan_itinerary(trip_id uuid,expected_version integer,action text,payload jsonb)
returns uuid language sql volatile security invoker set search_path='' as $$
  select private.plan_itinerary($1,$2,$3,$4)
$$;
