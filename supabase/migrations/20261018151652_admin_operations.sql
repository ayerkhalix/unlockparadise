begin;
create table public.place_redirects(slug text primary key,place_id uuid not null references public.places(id) on delete cascade);
alter table public.place_redirects enable row level security;
grant select on public.place_redirects to anon,authenticated;
grant all on public.place_redirects to service_role;
create policy redirects_read on public.place_redirects for select using(exists(select 1 from public.places p where p.id=place_id and p.status='publish'));

create function public.admin_save_place(pid uuid, body jsonb) returns uuid language plpgsql security definer set search_path='' as $$
 declare result_id uuid; old_slug text; item jsonb; position_number integer:=0;
 begin
 if not private.is_staff() then raise exception 'MFA staff required' using errcode='42501'; end if;
 if pid is not null then
 select slug into old_slug from public.places where id=pid for update;
 if old_slug is null then raise exception 'Place not found' using errcode='22023'; end if;
 end if;
 result_id=coalesce(pid,gen_random_uuid());
 insert into public.places(id,slug,title,status,vip_content,premium_content,listing_types,travel_minutes,accessibility,assets,featured,feature_order,published_at)
 values(result_id,body->>'slug',body->>'title',body->>'status',(body->>'vip_content')::boolean,(body->>'premium_content')::boolean,
 array(select jsonb_array_elements_text(body->'listing_types')),(body->>'travel_minutes')::numeric,
 array(select jsonb_array_elements_text(body->'accessibility')),array(select jsonb_array_elements_text(body->'assets')),
 (body->>'featured')::boolean,(body->>'feature_order')::integer,case when body->>'status'='publish' then now() else null end)
 on conflict(id) do update set slug=excluded.slug,title=excluded.title,status=excluded.status,vip_content=excluded.vip_content,
 premium_content=excluded.premium_content,listing_types=excluded.listing_types,travel_minutes=excluded.travel_minutes,
 accessibility=excluded.accessibility,assets=excluded.assets,featured=excluded.featured,feature_order=excluded.feature_order,
 published_at=coalesce(public.places.published_at,excluded.published_at);
 if old_slug is not null and old_slug<>body->>'slug' then
 insert into public.place_redirects values(old_slug,result_id) on conflict(slug) do update set place_id=excluded.place_id; end if;
 insert into public.place_details(place_id,description,content,excerpt,latitude,longitude,weekday_crowd,weekend_crowd)
 values(result_id,body->>'description',coalesce(body->>'content',''),coalesce(body->>'excerpt',''),(body->>'latitude')::numeric,(body->>'longitude')::numeric,body->>'weekday_crowd',body->>'weekend_crowd')
 on conflict(place_id) do update set description=excluded.description,content=excluded.content,excerpt=excluded.excerpt,latitude=excluded.latitude,
 longitude=excluded.longitude,weekday_crowd=excluded.weekday_crowd,weekend_crowd=excluded.weekend_crowd;
 delete from public.place_areas where place_id=result_id;
 insert into public.place_areas select result_id,value::uuid from jsonb_array_elements_text(body->'area_ids');
 delete from public.place_categories where place_id=result_id;
 insert into public.place_categories select result_id,value::uuid from jsonb_array_elements_text(body->'category_ids');
 delete from public.place_media where place_id=result_id;
 if body->>'cover_id' is not null then
 if not exists(select 1 from public.media where id=(body->>'cover_id')::uuid and bucket='destination-public' and status='ready')
 then raise exception 'A public verified image is required for the cover' using errcode='22023'; end if;
 insert into public.place_media values(result_id,(body->>'cover_id')::uuid,'cover',0); end if;
 for item in select * from jsonb_array_elements(body->'gallery') loop
 if not exists(select 1 from public.media where id=(item#>>'{}')::uuid and status='ready' and bucket in ('destination-public','destination-private'))
 then raise exception 'Gallery image unavailable' using errcode='22023'; end if;
 insert into public.place_media values(result_id,(item#>>'{}')::uuid,'gallery',position_number);position_number=position_number+1;
 end loop;
 return result_id; end $$;
create function public.admin_delete_place(pid uuid, confirm_slug text) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not private.is_admin() then raise exception 'MFA admin required' using errcode='42501'; end if;
 if not exists(select 1 from public.places where id=pid and slug=confirm_slug and status='archived')
 then raise exception 'Archive and confirm the slug before deletion' using errcode='22023'; end if;
 if exists(select 1 from public.member_places where place_id=pid) or exists(select 1 from public.reviews where place_id=pid)
 then raise exception 'Place has member data; keep it archived' using errcode='23503'; end if;
 delete from public.places where id=pid; end $$;
revoke all on function public.admin_save_place(uuid,jsonb),public.admin_delete_place(uuid,text) from public;
grant execute on function public.admin_save_place(uuid,jsonb),public.admin_delete_place(uuid,text) to authenticated;

-- Profiles do not expose user-editable legacy identifiers or elevated roles.
-- Restrict direct raw review submissions at the database boundary too.
create function private.review_spam_guard() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if auth.uid() is not null and not private.is_staff() then
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 if exists(select 1 from public.reviews where user_id=auth.uid() and created_at>now()-interval '10 seconds')
 then raise exception 'Please wait before posting another review' using errcode='22023'; end if;
 end if; return new; end $$;
create trigger review_spam_guard before insert on public.reviews for each row execute function private.review_spam_guard();
revoke all on all functions in schema private from public;
commit;
