begin;
-- One transaction for the day's edited notes/times. Reuse the existing locked,
-- owner/premium/version checked mutation; never grant direct table writes.
create function public.save_itinerary_changes(trip_id uuid, expected_version integer, changes jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare entry jsonb; next_version integer := expected_version;
begin
  if changes is null or jsonb_typeof(changes)<>'array' then
    raise exception 'Choose the stops to save' using errcode='22023';
  end if;
  if jsonb_array_length(changes) not between 1 and 50 then
    raise exception 'Save between 1 and 50 edited stops' using errcode='22023';
  end if;
  if (select count(distinct x->>'item_id') from jsonb_array_elements(changes) x) <> jsonb_array_length(changes) then
    raise exception 'Each stop must appear once' using errcode='22023';
  end if;
  for entry in select value from jsonb_array_elements(changes) loop
    if jsonb_typeof(entry)<>'object' or not (entry ?& array['item_id','notes','start_time','end_time'])
       or jsonb_typeof(entry->'notes')<>'string' or length(entry->>'notes')>2000 then
      raise exception 'Check the stop notes and visit times' using errcode='22023';
    end if;
    perform public.plan_itinerary(trip_id,next_version,'notes',entry);
    next_version := next_version+1;
    perform public.plan_itinerary(trip_id,next_version,'schedule',entry);
    next_version := next_version+1;
  end loop;
  return trip_id;
end $$;
revoke all on function public.save_itinerary_changes(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_itinerary_changes(uuid,integer,jsonb) to authenticated;
comment on function public.save_itinerary_changes(uuid,integer,jsonb) is 'Atomic owner-scoped note/time edits through the existing planner transaction; rolls back the complete batch on any failure.';
notify pgrst, 'reload schema';
commit;
