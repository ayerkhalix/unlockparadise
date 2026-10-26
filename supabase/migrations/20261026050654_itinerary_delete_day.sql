-- Extend the single, owner/version-checked planner transaction. No saved trip is
-- modified by this migration; only an explicit delete_day action removes data.
alter function private.plan_itinerary(uuid,integer,text,jsonb) rename to plan_itinerary_before_day_deletion;
revoke all on function private.plan_itinerary_before_day_deletion(uuid,integer,text,jsonb) from public,anon,authenticated,service_role;

create function private.plan_itinerary(trip_id uuid,expected_version integer,action text,payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  t public.itineraries;
  removed public.itinerary_days;
  later public.itinerary_days;
  n integer;
begin
  if action <> 'delete_day' then
    return private.plan_itinerary_before_day_deletion(trip_id,expected_version,action,payload);
  end if;
  if uid is null or not private.has_premium() then
    raise insufficient_privilege using message='Explorer+ required';
  end if;
  select * into t from public.itineraries where id=trip_id and user_id=uid for update;
  if t.id is null then raise exception 'Trip not found' using errcode='P0002'; end if;
  if expected_version is null or expected_version <> t.version then
    raise exception 'Plan changed; reload before editing' using errcode='40001';
  end if;
  select * into removed from public.itinerary_days where id=(payload->>'day_id')::uuid and itinerary_id=t.id;
  if removed.id is null then raise exception 'Day not found' using errcode='PT404'; end if;
  select count(*) into n from public.itinerary_days where itinerary_id=t.id;
  if n <= 1 then raise exception 'Keep at least one day in your trip.' using errcode='PT422'; end if;

  -- The existing composite foreign key cascades only this day's owned stops.
  delete from public.itinerary_days where id=removed.id and itinerary_id=t.id;
  -- Ascending individual updates avoid collisions with the immediate unique
  -- (itinerary_id,day_number) constraint, including the 60-day upper bound.
  for later in select * from public.itinerary_days where itinerary_id=t.id and day_number>removed.day_number order by day_number loop
    update public.itinerary_days set day_number=later.day_number-1 where id=later.id and itinerary_id=t.id;
  end loop;
  update public.itineraries set
    end_date=case when t.start_date is null then null else t.start_date+(n-2) end,
    version=version+1,updated_at=now()
    where id=t.id;
  return t.id;
end $$;
revoke all on function private.plan_itinerary(uuid,integer,text,jsonb) from public,anon;
grant execute on function private.plan_itinerary(uuid,integer,text,jsonb) to authenticated,service_role;
create or replace function public.plan_itinerary(trip_id uuid,expected_version integer,action text,payload jsonb)
returns uuid language sql volatile security invoker set search_path='' as $$
  select private.plan_itinerary($1,$2,$3,$4)
$$;
