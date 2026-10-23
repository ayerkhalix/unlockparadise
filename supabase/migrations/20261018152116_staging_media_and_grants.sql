begin;
-- Hosted Supabase can grant anon directly through default ACLs. Revoke explicitly.
revoke all on function public.admin_save_place(uuid,jsonb),public.admin_delete_place(uuid,text),public.admin_metrics(),public.admin_prepare_media_delete(uuid),public.set_member_place(uuid,text) from public,anon;
revoke all on public.media_files,public.place_redirects from anon,authenticated;
grant select on public.media_files,public.place_redirects to anon,authenticated;
alter default privileges in schema public revoke execute on functions from public,anon,authenticated;
alter default privileges in schema public revoke all on tables from anon,authenticated;
-- legacy means locally validated and awaiting Storage, never a verified cloud object.
alter table public.media drop constraint media_status_check;
alter table public.media add constraint media_status_check check(status in ('pending','ready','rejected','missing','legacy'));
alter table public.media add constraint legacy_media_source check(status<>'legacy' or (legacy_id is not null and original_path is not null and checksum is not null and bucket in ('destination-public','destination-private')));
create or replace function private.media_visible(mid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.media m where m.id=mid and (private.is_staff() or m.owner_id=auth.uid()
 or (m.status in ('ready','legacy') and (m.bucket='destination-public' or exists(
 select 1 from public.place_media pm where pm.media_id=m.id and private.can_view_place(pm.place_id))))))
$$;
create or replace function public.admin_save_place(pid uuid, body jsonb) returns uuid language plpgsql security definer set search_path='' as $$
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
 if not exists(select 1 from public.media where id=(body->>'cover_id')::uuid and bucket='destination-public' and status in ('ready','legacy'))
 then raise exception 'A public verified image is required for the cover' using errcode='22023'; end if;
 insert into public.place_media values(result_id,(body->>'cover_id')::uuid,'cover',0); end if;
 for item in select * from jsonb_array_elements(body->'gallery') loop
 if not exists(select 1 from public.media where id=(item#>>'{}')::uuid and status in ('ready','legacy') and bucket in ('destination-public','destination-private'))
 then raise exception 'Gallery image unavailable' using errcode='22023'; end if;
 insert into public.place_media values(result_id,(item#>>'{}')::uuid,'gallery',position_number);position_number=position_number+1;
 end loop;
 return result_id; end $$;

commit;
