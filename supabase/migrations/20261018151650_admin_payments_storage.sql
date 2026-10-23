begin;
-- MFA is enforced in PostgreSQL as well as at every Next.js admin entry point.
do $$ declare t text; begin
 foreach t in array array['places','place_details','place_areas','place_categories','areas','categories','place_media','taxonomy_media','media','reviews','membership_plans','app_settings'] loop
 execute format('grant insert,update,delete on public.%I to authenticated',t);
 execute format('create policy staff_write on public.%I for all to authenticated using(private.is_staff()) with check(private.is_staff())',t);
 end loop;
 foreach t in array array['user_roles','subscriptions','entitlements'] loop
 execute format('grant insert,update,delete on public.%I to authenticated',t);
 execute format('create policy admin_write on public.%I for all to authenticated using(private.is_admin()) with check(private.is_admin())',t);
 end loop;
end $$;

create function private.last_admin_guard() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if old.role='admin' and (tg_op='DELETE' or new.role<>'admin') then
 perform pg_advisory_xact_lock(20261018);
 if not exists(select 1 from public.user_roles where role='admin' and user_id<>old.user_id)
 then raise exception 'Cannot remove the last administrator' using errcode='42501'; end if;
 end if;
 return coalesce(new,old); end $$;
create trigger last_admin_guard before update or delete on public.user_roles for each row execute function private.last_admin_guard();

create function private.settings_guard() returns trigger language plpgsql set search_path='' as $$
 begin
 if (new.key='place_gate' and new.value not in ('"walled"'::jsonb,'"public"'::jsonb))
 or (new.key='review_write_level' and new.value not in ('"member"'::jsonb,'"vip"'::jsonb))
 or (new.key in ('review_moderation','avatar_moderation') and new.value not in ('"auto"'::jsonb,'"hold"'::jsonb))
 then raise exception 'Invalid setting' using errcode='22023'; end if;
 return new; end $$;
create trigger settings_guard before insert or update on public.app_settings for each row execute function private.settings_guard();

create unique index once_subscription on public.subscriptions(user_id) where kind='once';
create function private.php_add_months(ts timestamptz, months integer) returns timestamptz
 language sql immutable set search_path='' as $$
 select (date_trunc('month',ts at time zone 'UTC')+make_interval(months=>months)
 +(ts at time zone 'UTC'-date_trunc('month',ts at time zone 'UTC'))) at time zone 'UTC'
$$;
create function public.apply_paid_checkout(event_id text, session_id text, payment_id text, amount integer, currency_code text, event_hash text)
 returns jsonb language plpgsql security definer set search_path='' as $$
 declare tx public.payment_transactions; sub public.subscriptions; duration integer; end_date timestamptz; had_time boolean;
 begin
 select * into tx from public.payment_transactions where provider_session_id=session_id for update;
 if tx.id is null then raise exception 'Unmatched checkout' using errcode='22023'; end if;
 perform 1 from public.profiles where id=tx.user_id for update;
 if exists(select 1 from public.payment_events where provider_event_id=event_id) or tx.status='paid'
 then return jsonb_build_object('duplicate',true); end if;
 if tx.amount_centavos<>amount or tx.currency<>currency_code or tx.livemode
 or tx.status not in ('pending','creating','expired')
 then raise exception 'Payment reconciliation mismatch' using errcode='22023'; end if;
 select months into duration from public.membership_plans where id=tx.plan_id;
 select * into sub from public.subscriptions where user_id=tx.user_id and kind='once' for update;
 had_time=coalesce(sub.paid_through>now(),false);
 end_date=private.php_add_months(greatest(now(),coalesce(sub.paid_through,now())),duration);
 if sub.id is null then
 insert into public.subscriptions(user_id,plan_id,kind,status,provider,paid_through)
 values(tx.user_id,tx.plan_id,'once','active','paymongo',end_date) returning * into sub;
 else update public.subscriptions set plan_id=tx.plan_id,status='active',paid_through=end_date where id=sub.id; end if;
 insert into public.entitlements(user_id,subscription_id,source,expires_at,reason)
 values(tx.user_id,sub.id,'payment',end_date,'Verified PayMongo sandbox checkout')
 on conflict(subscription_id) do update set expires_at=excluded.expires_at,revoked_at=null;
 update public.payment_transactions set status='paid',provider_payment_id=payment_id,paid_at=now() where id=tx.id;
 insert into public.payment_events values(event_id,'checkout_session.payment.paid',tx.id,event_hash,now(),'credited');
 insert into public.membership_history(user_id,subscription_id,action) values(tx.user_id,sub.id,case when had_time then 'extended' else 'activated' end);
 insert into public.notification_outbox(user_id,template,dedupe_key,data)
 values(tx.user_id,case when had_time then 'extended' else 'welcome' end,'payment:'||tx.id,jsonb_build_object('expires_at',end_date)) on conflict do nothing;
 return jsonb_build_object('duplicate',false,'expires_at',end_date);
 end $$;
revoke all on function public.apply_paid_checkout(text,text,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.apply_paid_checkout(text,text,text,integer,text,text) to service_role;

create function public.schedule_membership_notifications() returns void language plpgsql security definer set search_path='' as $$
 begin
 insert into public.notification_outbox(user_id,template,dedupe_key,data)
 select user_id,'reminder','reminder:'||id||':'||paid_through,jsonb_build_object('expires_at',paid_through)
 from public.subscriptions where kind='once' and status='active' and paid_through>now() and paid_through<=now()+interval '3 days'
 on conflict do nothing;
 insert into public.notification_outbox(user_id,template,dedupe_key,data)
 select user_id,'ended','ended:'||id||':'||paid_through,jsonb_build_object('expires_at',paid_through)
 from public.subscriptions where kind='once' and status='active' and paid_through<=now() on conflict do nothing;
 update public.subscriptions set status='lapsed' where kind='once' and status='active' and paid_through<=now();
 end $$;
revoke all on function public.schedule_membership_notifications() from public,anon,authenticated;
grant execute on function public.schedule_membership_notifications() to service_role;

create table private.rate_limits (key text primary key, window_start timestamptz not null, hits integer not null);
create function public.consume_rate_limit(rate_key text, max_hits integer, window_seconds integer) returns boolean
 language plpgsql security definer set search_path='' as $$
 declare count_hits integer;
 begin
 insert into private.rate_limits values(rate_key,now(),1)
 on conflict(key) do update set hits=case when private.rate_limits.window_start<now()-make_interval(secs=>window_seconds) then 1 else private.rate_limits.hits+1 end,
 window_start=case when private.rate_limits.window_start<now()-make_interval(secs=>window_seconds) then now() else private.rate_limits.window_start end
 returning hits into count_hits;
 return count_hits<=max_hits;
 end $$;
revoke all on function public.consume_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer) to service_role;

-- Storage bucket policy: only consciously classified cover/taxonomy images are public.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('destination-public','destination-public',true,20971520,array['image/jpeg','image/png','image/webp','image/avif','image/gif','image/svg+xml']),
 ('destination-private','destination-private',false,20971520,array['image/jpeg','image/png','image/webp','image/avif','image/gif']),
 ('profile-private','profile-private',false,8388608,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do nothing;
create policy destination_storage_read on storage.objects for select to anon,authenticated using(
 bucket_id='destination-public' or exists(select 1 from public.media m where m.bucket=bucket_id and m.object_path=name and private.media_visible(m.id)));
create policy staff_storage_write on storage.objects for all to authenticated using(private.is_staff() and bucket_id in ('destination-public','destination-private','profile-private'))
 with check(private.is_staff() and bucket_id in ('destination-public','destination-private','profile-private'));
-- Profile uploads go through the validated image server, never directly to storage.
revoke all on all functions in schema private from public;
commit;
