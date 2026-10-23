begin;
alter table public.itinerary_items
 add column start_time time without time zone,
 add column end_time time without time zone,
 add constraint itinerary_stop_time_range check (
  (start_time is null and end_time is null) or
  (start_time is not null and end_time is not null and end_time>start_time
   and end_time<'24:00'::time and extract(second from start_time)=0 and extract(second from end_time)=0)
 );
comment on column public.itinerary_items.start_time is 'Optional local Palawan visit start, paired with end_time on the same itinerary day.';
-- Extend the existing locked, owner-checked transaction without replacing its permissions or date behavior.
do $migration$
declare definition text:=pg_get_functiondef('private.plan_itinerary(uuid,integer,text,jsonb)'::regprocedure);
 old_add text:=$old$insert into public.itinerary_items(itinerary_id,day_id,place_id,position)
       select t.id,did,pid,coalesce(max(position)+1,0) from public.itinerary_items where day_id=did;$old$;
begin
 if position(old_add in definition)=0 or position('elsif action in (''remove'',''move'',''notes'') then' in definition)=0 then
  raise exception 'Existing planner function differs; stop before changing its behavior';
 end if;
 definition:=replace(definition,old_add,$new$insert into public.itinerary_items(itinerary_id,day_id,place_id,position,start_time,end_time)
       select t.id,did,pid,coalesce(max(position)+1,0),nullif(payload->>'start_time','')::time,nullif(payload->>'end_time','')::time from public.itinerary_items where day_id=did;$new$);
 definition:=replace(definition,'elsif action in (''remove'',''move'',''notes'') then',$new$elsif action='schedule' then
     iid=(payload->>'item_id')::uuid;
     if not exists(select 1 from public.itinerary_items where id=iid and itinerary_id=t.id) then
       raise exception 'Stop not found' using errcode='22023';
     end if;
     update public.itinerary_items set start_time=nullif(payload->>'start_time','')::time,end_time=nullif(payload->>'end_time','')::time where id=iid and itinerary_id=t.id;
   elsif action in ('remove','move','notes') then$new$);
 execute definition;
end $migration$;
commit;
