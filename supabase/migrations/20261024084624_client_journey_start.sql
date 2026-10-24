-- Plain-language route authoring; existing verified journey facts are retained.
alter table public.place_details add column journey_start text not null default 'City proper'
  check (length(btrim(journey_start)) between 1 and 200);

alter function private.admin_save_place(uuid,jsonb) rename to admin_save_place_before_journey_start;
revoke all on function private.admin_save_place_before_journey_start(uuid,jsonb) from public,anon,authenticated;

create function private.admin_save_place(pid uuid,body jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result_id uuid;
begin
  if not private.is_staff() then raise insufficient_privilege; end if;
  if body ? 'journey_start' and (jsonb_typeof(body->'journey_start')<>'string'
    or length(btrim(body->>'journey_start')) not between 1 and 200) then
    raise check_violation using message='Supply a starting point of 1 to 200 characters.';
  end if;
  result_id=private.admin_save_place_before_journey_start(pid,body);
  if body ? 'journey_start' then
    update public.place_details set journey_start=btrim(body->>'journey_start') where place_id=result_id;
  end if;
  return result_id;
end $$;
revoke all on function private.admin_save_place(uuid,jsonb) from public,anon;
grant execute on function private.admin_save_place(uuid,jsonb) to authenticated,service_role;
