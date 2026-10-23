-- Keep one discovery outside a single-interest run when eligible variety exists.
-- Public review interests are relevant to the reviewed Place; the primary identity remains.
begin;
create or replace function private.public_traveler_badges(review_ids uuid[]) returns table(review_id uuid,archetype text,interests text[])
language sql stable security definer set search_path='' as $$
 select r.id,t.archetype, array(select k from unnest(t.interests) with ordinality i(k,n)
 where exists(select 1 from public.place_categories pc join public.categories c on c.id=pc.category_id
 where pc.place_id=r.place_id and c.slug=any(private.traveler_categories(array[k]))) order by n limit 2)
 from public.reviews r join public.traveler_preferences t on t.user_id=r.user_id
 where r.id=any(review_ids[1:100]) and r.status='approved' and private.can_view_place(r.place_id)
 and t.status='completed' and t.public_badges
$$;

create or replace function public.traveler_featured(max_results integer default 4) returns setof public.places
language sql stable security invoker set search_path='' as $$
 with prefs as (select interests,pace from public.traveler_preferences where user_id=(select auth.uid()) and status='completed' and cardinality(interests)>0),
 candidates as (
 select p.*, coalesce((select c.slug from public.place_categories pc join public.categories c on c.id=pc.category_id
 where pc.place_id=p.id and c.slug=any(private.traveler_categories(t.interests)) order by c.slug limit 1),'~editorial') match_category,
 (case when exists(select 1 from public.place_categories pc join public.categories c on c.id=pc.category_id where pc.place_id=p.id and c.slug=any(private.traveler_categories(t.interests))) then 20 else 0 end
 +case when p.featured then 4 else 0 end
 +case when exists(select 1 from public.place_details d where d.place_id=p.id and d.hike_minutes is not null and
 ((t.pace='adventure' and d.hike_minutes>=120) or (t.pace='slow' and d.hike_minutes<=60))) then 1 else 0 end) score
 from public.places p cross join prefs t where p.status='publish' and 'destination'=any(p.listing_types) and (not p.vip_content or private.has_premium())
 ), ranked as (select c.*,row_number() over(partition by match_category order by score desc,feature_order,published_at desc nulls last,id) category_position from candidates c)
 select p.* from ranked r join public.places p on p.id=r.id
 order by case when r.category_position=1 and r.score>=20 then 0 when r.category_position<=2 and r.score>=20 then 1 when r.category_position=1 and r.score<20 then 2 else 3 end,r.score desc,r.feature_order,r.published_at desc nulls last,r.id
 limit least(greatest(max_results,1),12)
$$;

commit;
