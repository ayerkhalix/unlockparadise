begin;
create or replace function private.admin_analytics(first_day date,last_day date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_admin() then raise exception 'MFA owner required' using errcode='42501'; end if;
 if first_day is null or last_day is null or last_day<first_day or last_day-first_day>92 then raise exception 'Choose up to 93 days' using errcode='22023'; end if;
 with period as (select * from public.analytics_events where day between first_day and last_day)
 select jsonb_build_object(
 'first_day',first_day,'last_day',last_day,
 'began_at',(select min(at) from public.analytics_events),
 'events',(select count(*) from period),'sessions',(select count(distinct session_id) from period),
 'totals',(select coalesce(jsonb_object_agg(name,n),'{}') from (select name,count(*) n from period group by name) a),
 'trend',(select coalesce(jsonb_agg(to_jsonb(t) order by t.day),'[]') from (select d::date as day,count(p.event_id) events,count(distinct p.session_id) sessions from generate_series(first_day::timestamp,last_day::timestamp,interval '1 day') d left join period p on p.day=d::date group by d) t),
 'places',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select p.id,p.title,count(*) filter(where e.name='place_viewed') views,count(*) filter(where e.name='place_saved') saves,count(*) filter(where e.name='place_added_to_itinerary') planned,count(distinct e.session_id) sessions from period e join public.places p on p.id=e.place_id group by p.id order by views desc,saves desc,p.title limit 20) t),
 'categories',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select c.name,count(*) views from period e join public.place_categories pc on pc.place_id=e.place_id join public.categories c on c.id=pc.category_id where e.name='place_viewed' group by c.id order by views desc,c.name) t),
 'areas',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select a.name,count(*) views from period e join public.place_areas pa on pa.place_id=e.place_id join public.areas a on a.id=pa.area_id where e.name='place_viewed' group by a.id order by views desc,a.name) t),
 'products',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select p.id,p.name,count(*) filter(where e.name='product_viewed') views,count(*) filter(where e.name='product_added_to_bag') bag_additions from period e join public.merch_products p on p.id=e.product_id group by p.id order by views desc,p.name limit 20) t),
 'current_saves',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select p.title,count(*) saves from public.member_places m join public.places p on p.id=m.place_id where m.saved_at is not null group by p.id order by saves desc,p.title limit 10) t),
 'current_planned',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select p.title,count(*) stops from public.itinerary_items i join public.places p on p.id=i.place_id group by p.id order by stops desc,p.title limit 10) t)
 ) into result;
 return result;
end $$;
create function private.admin_ranked_interest(first_day date,last_day date,metric text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'MFA owner required' using errcode='42501'; end if;
 if first_day is null or last_day is null or last_day<first_day or last_day-first_day>92 or metric is null or metric not in ('views','saves','planned') then raise exception 'Invalid ranking period or metric' using errcode='22023'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (
 select p.id,p.title,count(*) filter(where e.name='place_viewed') views,count(*) filter(where e.name='place_saved') saves,count(*) filter(where e.name='place_added_to_itinerary') planned,count(distinct e.session_id) sessions
 from public.analytics_events e join public.places p on p.id=e.place_id where e.day between first_day and last_day group by p.id
 having case metric when 'views' then count(*) filter(where e.name='place_viewed') when 'saves' then count(*) filter(where e.name='place_saved') when 'planned' then count(*) filter(where e.name='place_added_to_itinerary') end>0
 order by case metric when 'views' then count(*) filter(where e.name='place_viewed') when 'saves' then count(*) filter(where e.name='place_saved') when 'planned' then count(*) filter(where e.name='place_added_to_itinerary') end desc,p.title limit 20) r);
end $$;
create function public.admin_ranked_interest(first_day date,last_day date,metric text) returns jsonb language sql stable security invoker set search_path='' as $$select private.admin_ranked_interest($1,$2,$3)$$;
revoke all on function private.admin_ranked_interest(date,date,text),public.admin_ranked_interest(date,date,text) from public,anon;
grant execute on function private.admin_ranked_interest(date,date,text),public.admin_ranked_interest(date,date,text) to authenticated;
commit;
