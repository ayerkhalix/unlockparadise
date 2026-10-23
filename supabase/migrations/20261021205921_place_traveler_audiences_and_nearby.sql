-- Editorial targeting affects discovery, never membership or direct Place access.
alter table public.place_details
  add column traveler_types text[] not null default '{}',
  add column nearby_places jsonb not null default '[]';

alter table public.place_details add constraint place_traveler_types_valid check (
  cardinality(traveler_types)<=63 and array_position(traveler_types,null) is null
  and traveler_types <@ (array['wildcard']::text[] || array[
    'identity-1','identity-2','identity-3','identity-4','identity-5','identity-6','identity-7','identity-8','identity-9','identity-10',
    'identity-11','identity-12','identity-13','identity-14','identity-15','identity-16','identity-17','identity-18','identity-19','identity-20',
    'identity-21','identity-22','identity-23','identity-24','identity-25','identity-26','identity-27','identity-28','identity-29','identity-30',
    'identity-31','identity-32','identity-33','identity-34','identity-35','identity-36','identity-37','identity-38','identity-39','identity-40',
    'identity-41','identity-42','identity-43','identity-44','identity-45','identity-46','identity-47','identity-48','identity-49','identity-50',
    'identity-51','identity-52','identity-53','identity-54','identity-55','identity-56','identity-57','identity-58','identity-59','identity-60',
    'identity-61','identity-62']::text[])
);

create function private.valid_nearby_places(items jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare item jsonb; seen_ids text[]:='{}'; seen_links text[]:='{}'; identity_key text;
begin
  if jsonb_typeof(items)<>'array' or jsonb_array_length(items)>6 then return false; end if;
  for item in select * from jsonb_array_elements(items) loop
    if jsonb_typeof(item)<>'object' or not(item ?& array['id','name','maps_url','google_place_id','kind','note'])
      or exists(select 1 from jsonb_object_keys(item) k where k not in ('id','name','maps_url','google_place_id','kind','note'))
      or exists(select 1 from jsonb_each(item) p where jsonb_typeof(p.value)<>'string')
      or (item->>'id') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
      or length(btrim(item->>'name')) not between 1 and 160
      or length(item->>'note')>500 or length(item->>'maps_url')>2048
      or (item->>'maps_url') !~ '^https://((www\.)?google\.com(\.ph)?/maps(/|\?|$)|maps\.google\.com(\.ph)?/|maps\.app\.goo\.gl/|goo\.gl/maps/)'
      or (item->>'google_place_id'<>'' and (item->>'google_place_id') !~ '^[A-Za-z0-9_-]{10,255}$')
      or (item->>'kind') not in ('food','coffee','stay','activity','other') then return false; end if;
    identity_key=coalesce(nullif(item->>'google_place_id',''),item->>'maps_url');
    if (item->>'id')=any(seen_ids) or identity_key=any(seen_links) then return false; end if;
    seen_ids=array_append(seen_ids,item->>'id'); seen_links=array_append(seen_links,identity_key);
  end loop;
  return true;
exception when others then return false;
end $$;
revoke all on function private.valid_nearby_places(jsonb) from public;
grant execute on function private.valid_nearby_places(jsonb) to authenticated,service_role;
alter table public.place_details add constraint nearby_places_valid check(private.valid_nearby_places(nearby_places));

create or replace function private.admin_save_place(pid uuid,body jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result_id uuid;
begin
  if not private.is_staff() then raise insufficient_privilege; end if;
  result_id=private.admin_save_place_before_access_points(pid,body);
  if body ? 'access_points' then
    update public.place_details set access_points=body->'access_points' where place_id=result_id;
  end if;
  if body ? 'traveler_types' then
    if jsonb_typeof(body->'traveler_types')<>'array' then raise check_violation using message='Choose traveler types from the list.'; end if;
    update public.place_details set traveler_types=array(select distinct jsonb_array_elements_text(body->'traveler_types')) where place_id=result_id;
  end if;
  if body ? 'nearby_places' then
    update public.place_details set nearby_places=body->'nearby_places' where place_id=result_id;
  end if;
  return result_id;
end $$;

create or replace function public.traveler_featured(max_results integer default 4) returns setof public.places
language sql stable security invoker set search_path='' as $$
 with prefs as (
  select interests,pace,archetype from public.traveler_preferences
  where user_id=(select auth.uid()) and status='completed' and cardinality(interests)>0
 ), candidates as (
  select p.*, coalesce((select c.slug from public.place_categories pc join public.categories c on c.id=pc.category_id
    where pc.place_id=p.id and c.slug=any(private.traveler_categories(t.interests)) order by c.slug limit 1),'~editorial') match_category,
   (case when t.archetype=any(d.traveler_types) then 40 else 0 end
    +case when exists(select 1 from public.place_categories pc join public.categories c on c.id=pc.category_id where pc.place_id=p.id and c.slug=any(private.traveler_categories(t.interests))) then 20 else 0 end
    +case when p.featured then 4 else 0 end
    +case when d.hike_minutes is not null and ((t.pace='adventure' and d.hike_minutes>=120) or (t.pace='slow' and d.hike_minutes<=60)) then 1 else 0 end) score
  from public.places p cross join prefs t left join public.place_details d on d.place_id=p.id
  where p.status='publish' and 'destination'=any(p.listing_types) and (not p.vip_content or private.has_premium())
    and (coalesce(cardinality(d.traveler_types),0)=0 or t.archetype=any(d.traveler_types))
 ), ranked as (
  select c.*,row_number() over(partition by match_category order by score desc,feature_order,published_at desc nulls last,id) category_position from candidates c
 )
 select p.* from ranked r join public.places p on p.id=r.id
 order by case when r.score>=40 then 0 else 1 end,
  case when r.category_position=1 and r.score>=20 then 0 when r.category_position<=2 and r.score>=20 then 1 when r.category_position=1 and r.score<20 then 2 else 3 end,
  r.score desc,r.feature_order,r.published_at desc nulls last,r.id
 limit least(greatest(max_results,1),12)
$$;
