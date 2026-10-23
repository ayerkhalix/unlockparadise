begin;
-- Hiding a map pin does not hide an area's archive (Core group_upd_area_visibility).
drop policy public_areas on public.areas;
create policy public_areas on public.areas for select using(true);
-- Configuration and prices require an administrator, never a content editor.
drop policy staff_write on public.app_settings;
drop policy staff_write on public.membership_plans;
create policy admin_settings_write on public.app_settings for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy admin_plans_write on public.membership_plans for all to authenticated using(private.is_admin()) with check(private.is_admin());

create function public.review_like_counts(review_ids uuid[]) returns table(review_id uuid,likes bigint,liked boolean)
 language sql stable security definer set search_path='' as $$
 select r.id,count(l.user_id),coalesce(bool_or(l.user_id=auth.uid()),false) from public.reviews r
 left join public.review_likes l on l.review_id=r.id where r.id=any(review_ids) and r.status='approved'
 group by r.id
$$;
revoke all on function public.review_like_counts(uuid[]) from public;
grant execute on function public.review_like_counts(uuid[]) to anon,authenticated,service_role;

-- Store immutable original uploads and generated WordPress sizes separately.
create table public.media_files (
 id uuid primary key default gen_random_uuid(), media_id uuid not null references public.media(id) on delete cascade,
 variant text not null, bucket text not null check(bucket in ('destination-public','destination-private','media-archive')),
 object_path text not null check(object_path not like '%..%'), original_path text not null,
 mime_type text not null,byte_size bigint not null check(byte_size>=0),checksum text,
 status text not null default 'pending' check(status in ('pending','ready','missing')),
 unique(media_id,variant),unique(bucket,object_path)
);
alter table public.media_files enable row level security;
grant select on public.media_files to anon,authenticated;
grant all on public.media_files to service_role;
create policy media_files_read on public.media_files for select using(bucket<>'media-archive' and private.media_visible(media_id) or private.is_staff());
create index media_files_parent on public.media_files(media_id);
insert into storage.buckets(id,name,public,file_size_limit) values('media-archive','media-archive',false,104857600) on conflict do nothing;
create policy archive_storage_read on storage.objects for select to authenticated using(bucket_id='media-archive' and private.is_staff());
revoke all on all functions in schema private from public;
commit;
