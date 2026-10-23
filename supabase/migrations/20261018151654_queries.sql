begin;
create function public.find_places(area_slug text default null, category_slug text default null, search_text text default null,
 featured_only boolean default false, max_results integer default 100, page_offset integer default 0)
 returns setof public.places language sql stable security invoker set search_path='' as $$
 select p.* from public.places p where p.status='publish' and 'destination'=any(p.listing_types)
 and (not featured_only or p.featured)
 and (search_text is null or to_tsvector('simple',p.title)@@websearch_to_tsquery('simple',left(search_text,200)))
 and (area_slug is null or exists(select 1 from public.place_areas pa join public.areas a on a.id=pa.area_id where pa.place_id=p.id and a.slug=area_slug))
 and (category_slug is null or exists(select 1 from public.place_categories pc join public.categories c on c.id=pc.category_id where pc.place_id=p.id and c.slug=category_slug))
 order by case when featured_only then p.feature_order else 0 end,p.published_at desc nulls last,p.id
 limit least(greatest(max_results,1),500) offset greatest(page_offset,0)
$$;
revoke all on function public.find_places(text,text,text,boolean,integer,integer) from public;
grant execute on function public.find_places(text,text,text,boolean,integer,integer) to anon,authenticated,service_role;
commit;
