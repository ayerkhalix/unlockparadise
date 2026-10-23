begin;
-- Deletion safeguards must also survive direct REST access.
revoke delete on public.places from authenticated;
revoke update(terms_accepted_at) on public.profiles from authenticated;
create or replace function private.on_signup() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 insert into public.profiles(id,display_name,terms_accepted_at)
 values(new.id,'Explorer',case when new.raw_user_meta_data->>'terms_accepted'='true' then now() else null end)
 on conflict do nothing;return new;
 end $$;

alter table public.profile_media alter column media_id drop not null;
alter table public.profile_media add column pending_media_id uuid references public.media(id) on delete restrict;
alter table public.profile_media add constraint profile_photo_present check(media_id is not null or pending_media_id is not null);
create function private.promote_profile_photo() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if new.status='ready' and old.status='pending' then
 update public.profile_media set media_id=new.id,pending_media_id=null where pending_media_id=new.id;
 end if;return new;end $$;
create trigger promote_profile_photo after update on public.media for each row execute function private.promote_profile_photo();

create or replace function private.profile_feature_guard() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if new.featured_place_id is distinct from old.featured_place_id and new.featured_place_id is not null then
 if not private.can_view_place(new.featured_place_id) or not exists(select 1 from public.member_places where user_id=new.id and place_id=new.featured_place_id)
 then raise exception 'Pick an accessible place from your own lists' using errcode='42501'; end if;
 end if;return new;end $$;

create function public.admin_metrics() returns jsonb language plpgsql stable security definer set search_path='' as $$
 begin
 if not private.is_staff() then raise exception 'MFA staff required' using errcode='42501'; end if;
 return jsonb_build_object(
 'published',(select count(*) from public.places where status='publish'),
 'drafts',(select count(*) from public.places where status='draft'),
 'pending_reviews',(select count(*) from public.reviews where status='pending'),
 'accounts',case when private.is_admin() then (select count(*) from public.profiles) else null end,
 'active_memberships',case when private.is_admin() then (
 select count(distinct e.user_id) from public.entitlements e left join public.subscriptions s on s.id=e.subscription_id
 where e.revoked_at is null and e.starts_at<=now() and (e.expires_at is null or e.expires_at>now())
 and (e.source in ('manual','legacy') or (s.status in ('active','cancelled') and s.paid_through>now()))) else null end,
 'recent',case when private.is_admin() then (select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from
 (select action,table_name,record_id,at from public.audit_logs order by at desc limit 20) a) else '[]'::jsonb end);
 end $$;
revoke all on function public.admin_metrics() from public;
grant execute on function public.admin_metrics() to authenticated;

create function public.admin_prepare_media_delete(mid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
 declare media_row public.media;
 begin
 if not private.is_admin() then raise exception 'MFA administrator required' using errcode='42501'; end if;
 select * into media_row from public.media where id=mid for update;
 if media_row.id is null then raise exception 'Image unavailable' using errcode='22023'; end if;
 if exists(select 1 from public.place_media where media_id=mid) or exists(select 1 from public.taxonomy_media where media_id=mid)
 or exists(select 1 from public.profile_media where media_id=mid or pending_media_id=mid)
 then raise exception 'Image is still associated with content' using errcode='23503'; end if;
 update public.media set status='rejected' where id=mid;
 return jsonb_build_object('bucket',media_row.bucket,'object_path',media_row.object_path,
 'variants',(select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket,'object_path',object_path)),'[]'::jsonb) from public.media_files where media_id=mid));
 end $$;
revoke all on function public.admin_prepare_media_delete(uuid) from public;
grant execute on function public.admin_prepare_media_delete(uuid) to authenticated;
create policy archive_storage_delete on storage.objects for delete to authenticated using(bucket_id='media-archive' and private.is_admin());
revoke all on all functions in schema private from public;
commit;
