begin;
create or replace function private.admin_metrics() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_staff() then raise exception 'MFA content permission required' using errcode='42501'; end if;
 return jsonb_build_object(
 'published',(select count(*) from public.places where status='publish'),
 'drafts',(select count(*) from public.places where status='draft'),
 'pending_reviews',(select count(*) from public.reviews where status='pending'),
 'accounts',case when private.is_admin() then (select count(*) from public.profiles) else null end,
 'active_memberships',case when private.is_admin() then (select count(distinct e.user_id) from public.entitlements e left join public.subscriptions s on s.id=e.subscription_id where e.revoked_at is null and e.starts_at<=now() and (e.expires_at is null or e.expires_at>now()) and (e.source in ('manual','legacy') or (s.status in ('active','cancelled') and s.paid_through>now()))) else null end,
 'recent',(select coalesce(jsonb_agg(to_jsonb(r) order by r.at desc),'[]') from (
 select a.action,a.table_name,a.record_id,a.at,coalesce(p.title,m.name,review.author_name,'Retained record') as label
 from (select * from public.audit_logs where private.is_admin() or table_name in ('places','place_details','reviews','place_recommendations') order by at desc,id desc limit 12) a
 left join public.places p on a.table_name='places' and p.id::text=a.record_id
 left join public.merch_products m on a.table_name='merch_products' and m.id::text=a.record_id
 left join public.reviews review on a.table_name='reviews' and review.id::text=a.record_id
 ) r));
end $$;

create function private.admin_media_usage() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare bytes bigint:=null;
begin
 if not private.is_admin() then raise exception 'MFA owner required' using errcode='42501'; end if;
 if exists(select 1 from information_schema.columns where table_schema='storage' and table_name='objects' and column_name='metadata') then
  execute $q$select coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint else 0 end),0) from storage.objects where bucket_id in ('destination-public','destination-private','profile-private','media-archive')$q$ into bytes;
 end if;
 return jsonb_build_object('stored_bytes',bytes,'media_records',(select count(*) from public.media),'upload_limit_bytes',5242880);
end $$;
create function public.admin_media_usage() returns jsonb language sql stable security invoker set search_path='' as $$select private.admin_media_usage()$$;
revoke all on function private.admin_media_usage(),public.admin_media_usage() from public,anon;
grant execute on function private.admin_media_usage(),public.admin_media_usage() to authenticated;

create index analytics_expiry on public.analytics_events(at);
create function private.purge_interest_events() returns bigint language plpgsql security definer set search_path='' as $$
declare deleted bigint;
begin
 delete from public.analytics_events where at<now()-interval '90 days';
 get diagnostics deleted=row_count;
 return deleted;
end $$;
revoke all on function private.purge_interest_events() from public,anon,authenticated;
grant execute on function private.purge_interest_events() to service_role;

-- Supabase supports pg_cron. Embedded test Postgres intentionally has no scheduler.
do $schedule$
begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('upd-interest-retention','0 19 * * *',$job$select private.purge_interest_events();delete from cron.job_run_details where jobid=(select jobid from cron.job where jobname='upd-interest-retention') and end_time<now()-interval '7 days';$job$);
 end if;
end $schedule$;
commit;
