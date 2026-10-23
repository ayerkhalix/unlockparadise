begin;

-- Premium identities are private, including direct REST reads and named aliases.
alter policy published_places on public.places using (
  (status='publish' and (not vip_content or (select private.has_premium())))
  or (select private.is_staff())
);
alter policy reviews_read on public.reviews using (
  (select private.is_staff()) or (
    (status='approved' or user_id=(select auth.uid())) and exists (
      select 1 from public.places p where p.id=place_id and p.status='publish'
    )
  )
);

-- Public buckets may contain legacy covers whose metadata names a hidden Place.
create or replace function private.media_visible(mid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.media m where m.id=mid and (
   private.is_staff() or m.owner_id=auth.uid() or (
     m.status in ('ready','legacy') and (
       (m.bucket='destination-public' and not exists (
         select 1 from public.place_media pm join public.places p on p.id=pm.place_id
         where pm.media_id=m.id and p.vip_content and not private.can_view_place(p.id)
       )) or exists (
         select 1 from public.place_media pm where pm.media_id=m.id and private.can_view_place(pm.place_id)
       )
     )
   )
 ))
$$;

-- A deliberately limited projection is needed to retain anonymous locked cards.
-- The implementation stays private; it never returns raw rows or unreviewed JSON.
create function private.browse_places(
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
    select jsonb_agg(jsonb_build_object('kind',pm.kind,'position',pm.position,'media',jsonb_build_object('id',m.id,'status',m.status,'alt',m.alt)))
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
revoke all on function private.browse_places(text,text,text,boolean,integer,integer) from public;
grant execute on function private.browse_places(text,text,text,boolean,integer,integer) to anon,authenticated,service_role;
create function public.browse_places(
 area_slug text default null,category_slug text default null,search_text text default null,
 featured_only boolean default false,max_results integer default 100,page_offset integer default 0
) returns setof jsonb language sql stable security invoker set search_path='' as $$
 select * from private.browse_places($1,$2,$3,$4,$5,$6)
$$;
revoke all on function public.browse_places(text,text,text,boolean,integer,integer) from public;
grant execute on function public.browse_places(text,text,text,boolean,integer,integer) to anon,authenticated,service_role;

-- Opaque URLs resolve to a generic gate, without serializing the real slug/name.
create function private.locked_place(identifier text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'slug',p.id::text,'title','Explorer+ destination')
 from public.places p where p.status='publish' and p.vip_content
 and 'destination'=any(p.listing_types) and (p.id::text=identifier or p.slug=identifier
 or exists(select 1 from public.place_redirects r where r.place_id=p.id and r.slug=identifier)) limit 1
$$;
revoke all on function private.locked_place(text) from public;
grant execute on function private.locked_place(text) to anon,authenticated,service_role;
create function public.locked_place(identifier text) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.locked_place($1) $$;
revoke all on function public.locked_place(text) from public;
grant execute on function public.locked_place(text) to anon,authenticated,service_role;

-- Retain existing trips after expiry, while closing reads and mutations.
alter policy trip_owner on public.itineraries using (
 user_id=(select auth.uid()) and (select private.has_premium())
);
alter function private.plan_itinerary(uuid,integer,text,jsonb) rename to plan_itinerary_before_membership;
revoke all on function private.plan_itinerary_before_membership(uuid,integer,text,jsonb) from public,anon,authenticated;
create function private.plan_itinerary(trip_id uuid,expected_version integer,action text,payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.has_premium() then
  raise exception 'Explorer+ required' using errcode='42501';
 end if;
 return private.plan_itinerary_before_membership(trip_id,expected_version,action,payload);
end $$;
revoke all on function private.plan_itinerary(uuid,integer,text,jsonb) from public;
grant execute on function private.plan_itinerary(uuid,integer,text,jsonb) to authenticated,service_role;

commit;
