-- Reversible itinerary removal retains the existing owner/area/version checks.
alter function private.plan_itinerary(uuid,integer,text,jsonb) rename to plan_itinerary_before_recovery;
revoke all on function private.plan_itinerary_before_recovery(uuid,integer,text,jsonb) from public,anon,authenticated,service_role;
create function private.plan_itinerary(trip_id uuid,expected_version integer,action text,payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); t public.itineraries; result_id uuid; did uuid; pid uuid; restored uuid; target_position integer;
begin
  if action<>'restore' then return private.plan_itinerary_before_recovery(trip_id,expected_version,action,payload); end if;
  if uid is null or not private.has_premium() then raise insufficient_privilege using message='Explorer+ required'; end if;
  select * into t from public.itineraries where id=trip_id and user_id=uid for update;
  if t.id is null then raise exception 'Trip not found' using errcode='P0002'; end if;
  if expected_version is null or expected_version<>t.version then raise exception 'Plan changed; reload before editing' using errcode='40001'; end if;
  did=(payload->>'day_id')::uuid; pid=(payload->>'place_id')::uuid;
  target_position=(payload->>'position')::integer;
  if target_position is null or target_position not between 0 and 49 or length(coalesce(payload->>'notes',''))>2000 then
    raise exception 'Invalid restored stop' using errcode='22023';
  end if;
  -- The canonical add path checks day membership, published content, area, capacity,
  -- duplicate Places and valid same-day times, and advances the version once.
  result_id=private.plan_itinerary_before_recovery(trip_id,expected_version,'add',payload);
  select id into restored from public.itinerary_items where itinerary_id=t.id and day_id=did and place_id=pid;
  update public.itinerary_items set notes=coalesce(payload->>'notes','') where id=restored;
  target_position=least(target_position,(select count(*)::integer-1 from public.itinerary_items where day_id=did));
  with remaining as (select id,row_number() over(order by position)-1 as n from public.itinerary_items where day_id=did and id<>restored),
  positions as (select id,case when n>=target_position then n+1 else n end as n from remaining union all select restored,target_position)
  update public.itinerary_items i set position=p.n from positions p where i.id=p.id;
  return result_id;
end $$;
revoke all on function private.plan_itinerary(uuid,integer,text,jsonb) from public,anon;
grant execute on function private.plan_itinerary(uuid,integer,text,jsonb) to authenticated,service_role;

-- Focal points belong to the use of a photo, preserving original image files.
alter table public.place_media add column focal_x numeric(5,2) not null default 50 check(focal_x between 0 and 100),
  add column focal_y numeric(5,2) not null default 50 check(focal_y between 0 and 100);
create function private.valid_focal_point(point jsonb) returns boolean language sql immutable set search_path='' as $$
  select case when jsonb_typeof(point)='object' and jsonb_typeof(point->'x')='number' and jsonb_typeof(point->'y')='number'
    then (point->>'x')::numeric between 0 and 100 and (point->>'y')::numeric between 0 and 100
      and (select count(*) from jsonb_object_keys(point))=2 else false end
$$;
revoke all on function private.valid_focal_point(jsonb) from public,anon,authenticated,service_role;

alter function private.admin_save_place(uuid,jsonb) rename to admin_save_place_before_focal;
revoke all on function private.admin_save_place_before_focal(uuid,jsonb) from public,anon,authenticated,service_role;
create function private.admin_save_place(pid uuid,body jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid; item record; previous_points jsonb;
begin
  if not private.is_staff() then raise insufficient_privilege; end if;
  select coalesce(jsonb_object_agg(media_id::text,jsonb_build_object('x',focal_x,'y',focal_y)),'{}'::jsonb)
    into previous_points from public.place_media where place_id=pid;
  -- The existing implementation enforces staff/MFA, optimistic concurrency,
  -- permitted media and all other Place validation in this same transaction.
  result_id=private.admin_save_place_before_focal(pid,body);
  if body ? 'focal_points' then
    if jsonb_typeof(body->'focal_points')<>'object' or (select count(*) from jsonb_object_keys(body->'focal_points'))>9 then
      raise check_violation using message='Choose valid focal points for up to nine photos.';
    end if;
    for item in select * from jsonb_each(body->'focal_points') loop
      if not private.valid_focal_point(item.value) or not exists(select 1 from public.place_media where place_id=result_id and media_id=item.key::uuid) then
        raise check_violation using message='A focal point must belong to a selected photo.';
      end if;
    end loop;
  end if;
  update public.place_media pm set focal_x=(points.value->>'x')::numeric,focal_y=(points.value->>'y')::numeric
    from jsonb_each(previous_points || coalesce(body->'focal_points','{}'::jsonb)) points
    where pm.place_id=result_id and pm.media_id=points.key::uuid;
  return result_id;
end $$;
revoke all on function private.admin_save_place(uuid,jsonb) from public,anon;
grant execute on function private.admin_save_place(uuid,jsonb) to authenticated,service_role;

-- Product image JSON already saves atomically with the versioned product.
create or replace function private.valid_product_images(images jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select jsonb_typeof(images)='array' and jsonb_array_length(images) between 1 and 8 and not exists(
 select 1 from jsonb_array_elements(images) i where jsonb_typeof(i)<>'object' or length(coalesce(i->>'alt',''))>300
 or (i ? 'focal' and not private.valid_focal_point(i->'focal'))
 or not (coalesce(i->>'src','') ~ '^/merch/images/[a-zA-Z0-9_-]+\.(png|webp|jpg|jpeg)$'
 or exists(select 1 from public.media m where '/api/media/'||m.id::text||'/'=i->>'src' and m.bucket='destination-public' and m.status='ready')))
$$;

-- Preserve the existing deliberately limited public projection and its access rules.
create or replace function private.browse_places(
 area_slug text default null,category_slug text default null,search_text text default null,
 featured_only boolean default false,max_results integer default 100,page_offset integer default 0
) returns setof jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'id',p.id,'legacy_id',case when p.vip_content and not private.has_premium() then null else p.legacy_id end,
  'slug',case when p.vip_content and not private.has_premium() then p.id::text else p.slug end,
  'title',case when p.vip_content and not private.has_premium() then 'Explorer+ destination' else p.title end,
  'vip_content',p.vip_content,'status',p.status,
  'travel_minutes',case when p.vip_content and not private.has_premium() then null else p.travel_minutes end,
  'accessibility',case when p.vip_content and not private.has_premium() then '[]'::jsonb else to_jsonb(p.accessibility) end,
  'assets',case when p.vip_content and not private.has_premium() then '[]'::jsonb else to_jsonb(p.assets) end,
  'published_at',p.published_at,'featured',p.featured,'feature_order',p.feature_order,
  'place_areas',coalesce((select jsonb_agg(jsonb_build_object('areas',jsonb_build_object('id',a.id,'slug',a.slug,'name',a.name)))
    from public.place_areas pa join public.areas a on a.id=pa.area_id where pa.place_id=p.id),'[]'::jsonb),
  'place_categories',coalesce((select jsonb_agg(jsonb_build_object('categories',jsonb_build_object('id',c.id,'slug',c.slug,'name',c.name)))
    from public.place_categories pc join public.categories c on c.id=pc.category_id where pc.place_id=p.id),'[]'::jsonb),
  'place_media',case when p.vip_content and not private.has_premium() then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('kind',pm.kind,'position',pm.position,'focal_x',pm.focal_x,'focal_y',pm.focal_y,'media',jsonb_build_object('id',m.id,'status',m.status,'alt',m.alt)))
    from public.place_media pm join public.media m on m.id=pm.media_id
    where pm.place_id=p.id and private.media_visible(m.id) and
      (pm.kind='cover' or private.can_view_place(p.id) or m.bucket='destination-public')
  ),'[]'::jsonb) end,
  'reviews',case when p.vip_content and not private.has_premium() then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('rating',r.rating,'status',r.status))
    from public.reviews r where r.place_id=p.id and r.status='approved'
  ),'[]'::jsonb) end,
  'place_details',case when private.can_view_place(p.id) then (
    select jsonb_build_object('hike_minutes',d.hike_minutes,'transport_minutes',d.transport_minutes)
    from public.place_details d where d.place_id=p.id
  ) else null end
 ) from public.places p
 where p.status='publish' and 'destination'=any(p.listing_types)
 and (not featured_only or p.featured)
 and (search_text is null or btrim(search_text)='' or (
   (not p.vip_content or private.has_premium()) and
   to_tsvector('simple',p.title)@@websearch_to_tsquery('simple',left(search_text,200))
 ))
 and (area_slug is null or exists(select 1 from public.place_areas pa join public.areas a on a.id=pa.area_id where pa.place_id=p.id and a.slug=area_slug))
 and (category_slug is null or exists(select 1 from public.place_categories pc join public.categories c on c.id=pc.category_id where pc.place_id=p.id and c.slug=category_slug))
 order by case when featured_only then p.feature_order else 0 end,p.published_at desc nulls last,p.id
 limit least(greatest(max_results,1),500) offset greatest(page_offset,0)
$$;
