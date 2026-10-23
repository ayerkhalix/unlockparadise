begin;
alter table public.payment_transactions drop constraint payment_transactions_provider_check;
alter table public.payment_transactions add constraint payment_transactions_provider_check check(provider in ('paymongo','xendit'));
alter table public.subscriptions drop constraint subscriptions_provider_check;
alter table public.subscriptions add constraint subscriptions_provider_check check(provider in ('paymongo','xendit','legacy','manual'));
alter table public.payment_transactions add column duration_months integer check(duration_months in (1,3,12));
alter table public.payment_transactions add column provider_business_id text;
alter table public.payment_transactions add column provider_expires_at timestamptz;

-- Financial writes remain service-only. All paths lock profile, transaction,
-- then subscription in that order; two checkouts cannot credit concurrently.
create function private.credit_membership_checkout(event_id text,session_id text,payment_id text,amount integer,currency_code text,event_hash text,expected_provider text,event_type text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare tx public.payment_transactions; sub public.subscriptions; duration integer; end_date timestamptz; had_time boolean; customer uuid;
begin
 select user_id into customer from public.payment_transactions where provider_session_id=session_id;
 if customer is null then raise exception 'Unmatched checkout' using errcode='22023'; end if;
 perform 1 from public.profiles where id=customer for update;
 select * into tx from public.payment_transactions where provider_session_id=session_id for update;
 if tx.provider<>expected_provider or tx.amount_centavos<>amount or tx.currency<>currency_code or tx.livemode
 or payment_id is null or length(payment_id) not between 1 and 200
 then raise exception 'Payment reconciliation mismatch' using errcode='22023'; end if;
 if exists(select 1 from public.payment_events e where e.provider_event_id=event_id and e.transaction_id is distinct from tx.id)
 then raise exception 'Event belongs to another transaction' using errcode='22023'; end if;
 if exists(select 1 from public.payment_events where provider_event_id=event_id) or tx.status='paid'
 then return jsonb_build_object('duplicate',true); end if;
 if tx.status not in ('pending','creating','expired') then raise exception 'Checkout cannot be credited' using errcode='22023'; end if;
 duration=tx.duration_months;
 if duration is null then select months into duration from public.membership_plans where id=tx.plan_id; end if;
 select * into sub from public.subscriptions where user_id=tx.user_id and kind='once' for update;
 had_time=coalesce(sub.paid_through>now(),false);
 end_date=private.php_add_months(greatest(now(),coalesce(sub.paid_through,now())),duration);
 if sub.id is null then
   insert into public.subscriptions(user_id,plan_id,kind,status,provider,paid_through)
   values(tx.user_id,tx.plan_id,'once','active',expected_provider,end_date) returning * into sub;
 else
   update public.subscriptions set plan_id=tx.plan_id,status='active',provider=expected_provider,paid_through=end_date where id=sub.id;
 end if;
 insert into public.entitlements(user_id,subscription_id,source,expires_at,reason)
 values(tx.user_id,sub.id,'payment',end_date,'Verified '||expected_provider||' sandbox checkout')
 on conflict(subscription_id) do update set expires_at=excluded.expires_at,revoked_at=null,reason=excluded.reason;
 update public.payment_transactions set status='paid',provider_payment_id=payment_id,paid_at=now() where id=tx.id;
 insert into public.payment_events(provider_event_id,event_type,transaction_id,payload_hash,outcome)
 values(event_id,event_type,tx.id,event_hash,'credited');
 insert into public.membership_history(user_id,subscription_id,action)
 values(tx.user_id,sub.id,case when had_time then 'extended' else 'activated' end);
 insert into public.notification_outbox(user_id,template,dedupe_key,data)
 values(tx.user_id,case when had_time then 'extended' else 'welcome' end,'payment:'||tx.id,jsonb_build_object('expires_at',end_date)) on conflict do nothing;
 return jsonb_build_object('duplicate',false,'expires_at',end_date);
end $$;
revoke all on function private.credit_membership_checkout(text,text,text,integer,text,text,text,text) from public,anon,authenticated;
grant execute on function private.credit_membership_checkout(text,text,text,integer,text,text,text,text) to service_role;
grant execute on function private.php_add_months(timestamptz,integer) to service_role;
-- Retain the PayMongo contract, with an explicit provider boundary.
create or replace function public.apply_paid_checkout(event_id text,session_id text,payment_id text,amount integer,currency_code text,event_hash text)
returns jsonb language sql security invoker set search_path='' as $$
 select private.credit_membership_checkout($1,$2,$3,$4,$5,$6,'paymongo','checkout_session.payment.paid')
$$;
revoke all on function public.apply_paid_checkout(text,text,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.apply_paid_checkout(text,text,text,integer,text,text) to service_role;

create function public.prepare_xendit_membership_checkout(customer uuid,plan_key text,request_key uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare tx public.payment_transactions; plan public.membership_plans;
begin
 perform 1 from public.profiles where id=customer for update;
 if not found then raise exception 'Account unavailable' using errcode='22023'; end if;
 if exists(select 1 from public.user_roles where user_id=customer)
 or exists(select 1 from public.entitlements where user_id=customer and revoked_at is null and expires_at is null)
 then raise sqlstate 'PT409' using message='This account does not need a paid membership.'; end if;
 if exists(select 1 from public.subscriptions where user_id=customer and kind='subscription' and status in ('active','past_due'))
 then raise sqlstate 'PT409' using message='Reconcile the existing subscription before purchasing.'; end if;
 select * into plan from public.membership_plans where id=plan_key and active;
 if plan.id is null then raise exception 'Plan unavailable' using errcode='22023'; end if;
 select * into tx from public.payment_transactions where idempotency_key=request_key;
 if tx.id is not null then
   if tx.user_id<>customer or tx.plan_id<>plan_key or tx.provider<>'xendit'
   then raise sqlstate 'PT409' using message='Checkout request already used.'; end if;
   return jsonb_build_object('created',false,'transaction',to_jsonb(tx));
 end if;
 select * into tx from public.payment_transactions where user_id=customer and status in ('creating','pending') for update;
 if tx.id is not null then
   if tx.plan_id<>plan_key or tx.provider<>'xendit'
   then raise sqlstate 'PT409' using message='Finish the existing checkout before changing plans.'; end if;
   return jsonb_build_object('created',false,'transaction',to_jsonb(tx));
 end if;
 insert into public.payment_transactions(user_id,plan_id,provider,idempotency_key,amount_centavos,duration_months)
 values(customer,plan.id,'xendit',request_key,plan.amount_centavos,plan.months) returning * into tx;
 return jsonb_build_object('created',true,'transaction',to_jsonb(tx));
end $$;
revoke all on function public.prepare_xendit_membership_checkout(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.prepare_xendit_membership_checkout(uuid,text,uuid) to service_role;

create function public.attach_xendit_membership_session(transaction_id uuid,session_id text,checkout_link text,business_id text,expiry timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare tx public.payment_transactions; customer uuid;
begin
 select user_id into customer from public.payment_transactions where id=transaction_id;
 perform 1 from public.profiles where id=customer for update;
 select * into tx from public.payment_transactions where id=transaction_id for update;
 if tx.id is null or tx.provider<>'xendit' or session_id !~ '^ps-[a-f0-9]{24}$'
 or checkout_link !~ '^https://(checkout-staging[.]xendit[.]co|dev[.]xen[.]to)/'
 or coalesce(length(business_id),0)=0
 or (tx.provider_session_id is not null and tx.provider_session_id<>session_id)
 or (tx.provider_business_id is not null and tx.provider_business_id<>business_id)
 then raise exception 'Session mismatch' using errcode='22023'; end if;
 update public.payment_transactions set provider_session_id=session_id,checkout_url=checkout_link,
 provider_business_id=business_id,provider_expires_at=expiry,
 status=case when status='creating' then 'pending' else status end where id=transaction_id;
end $$;
revoke all on function public.attach_xendit_membership_session(uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.attach_xendit_membership_session(uuid,text,text,text,timestamptz) to service_role;

create function public.apply_xendit_membership_event(event_id text,session_id text,payment_id text,amount integer,currency_code text,event_hash text,session_state text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare tx public.payment_transactions; customer uuid;
begin
 if session_state='COMPLETED' then
   return private.credit_membership_checkout(event_id,session_id,payment_id,amount,currency_code,event_hash,'xendit','payment_session.completed');
 end if;
 if session_state not in ('EXPIRED','CANCELED') then raise exception 'Unsupported state' using errcode='22023'; end if;
 select user_id into customer from public.payment_transactions where provider_session_id=session_id;
 perform 1 from public.profiles where id=customer for update;
 select * into tx from public.payment_transactions where provider_session_id=session_id for update;
 if tx.id is null or tx.provider<>'xendit' or tx.amount_centavos<>amount or tx.currency<>currency_code or tx.livemode
 then raise exception 'Session mismatch' using errcode='22023'; end if;
 if tx.status='paid' or exists(select 1 from public.payment_events where provider_event_id=event_id)
 then return jsonb_build_object('duplicate',true); end if;
 if tx.status in ('creating','pending') then update public.payment_transactions set status='expired' where id=tx.id; end if;
 insert into public.payment_events(provider_event_id,event_type,transaction_id,payload_hash,outcome)
 values(event_id,'payment_session.'||lower(session_state),tx.id,event_hash,'closed_without_access');
 return jsonb_build_object('duplicate',false);
end $$;
revoke all on function public.apply_xendit_membership_event(text,text,text,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.apply_xendit_membership_event(text,text,text,integer,text,text,text) to service_role;
commit;
