begin;

-- Extend the established owner/editor model only for fulfillment duties.
alter table public.user_roles drop constraint user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check check(role in ('admin','editor','order_manager'));
create function private.can_manage_orders() returns boolean language sql stable security definer set search_path='' as $$
 select (auth.jwt()->>'aal')='aal2' and exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role in ('admin','order_manager'))
$$;
revoke all on function private.can_manage_orders() from public,anon;
grant execute on function private.can_manage_orders() to authenticated;
create or replace function public.viewer_access() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('premium',private.has_premium(),'staff',private.is_staff(),'admin',private.is_admin(),'orders',private.can_manage_orders())
$$;

alter table public.audit_logs add column summary jsonb not null default '{}';
create index audit_recent on public.audit_logs(at desc,id desc);
create index audit_entity on public.audit_logs(table_name,record_id,at desc);
create or replace function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare n jsonb:=to_jsonb(new); o jsonb:=to_jsonb(old); changes jsonb;
begin
 select coalesce(jsonb_object_agg(k,jsonb_build_object('from',o->k,'to',n->k)),'{}') into changes
 from unnest(array['title','name','status','role','price_centavos','stock','active','fulfillment_status','revoked_at','expires_at','featured','value']) k
 where n->k is distinct from o->k and (n ? k or o ? k);
 insert into public.audit_logs(actor_id,action,table_name,record_id,summary)
 values(auth.uid(),tg_op,tg_table_name,coalesce(n->>'id',o->>'id',n->>'key',o->>'key',n->>'user_id',o->>'user_id'),changes);
 return coalesce(new,old);
end $$;

-- Referenced Places are archived, never removed from member history.
create or replace function private.admin_delete_place(pid uuid,confirm_slug text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'MFA owner required' using errcode='42501'; end if;
 perform 1 from public.places where id=pid and slug=confirm_slug and status='archived' for update;
 if not found then raise exception 'Archive and confirm the exact slug' using errcode='22023'; end if;
 if exists(select 1 from public.member_places where place_id=pid)
 or exists(select 1 from public.reviews where place_id=pid)
 or exists(select 1 from public.profiles where featured_place_id=pid)
 or exists(select 1 from public.itinerary_items where place_id=pid)
 or exists(select 1 from public.place_recommendations where source_place_id=pid or recommended_place_id=pid)
 then raise exception 'Referenced Place: retain its archive' using errcode='23503'; end if;
 delete from public.places where id=pid;
end $$;

-- Extend the existing transactional Place save rather than duplicate it.
alter function private.admin_save_place(uuid,jsonb) rename to admin_save_place_phase2;
revoke all on function private.admin_save_place_phase2(uuid,jsonb) from authenticated;
create function private.admin_save_place(pid uuid,body jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid; place_timestamp timestamptz;
begin
 if not private.is_staff() then raise exception 'MFA content permission required' using errcode='42501'; end if;
 if pid is not null then
   select updated_at into place_timestamp from public.places where id=pid for update;
   if body ? 'expected_updated_at' and place_timestamp is distinct from (body->>'expected_updated_at')::timestamptz
   then raise sqlstate 'PT409' using message='This Place changed. Reload before saving.'; end if;
 end if;
 result_id=private.admin_save_place_phase2(pid,body);
 if body ? 'seo' then update public.place_details set seo=jsonb_build_object('title',left(coalesce(body->'seo'->>'title',''),160),'description',left(coalesce(body->'seo'->>'description',''),320),'canonical',left(coalesce(body->'seo'->>'canonical',''),500)) where place_id=result_id; end if;
 return result_id;
end $$;
create or replace function public.admin_save_place(pid uuid,body jsonb) returns uuid language sql volatile security invoker set search_path='' as $$select private.admin_save_place($1,$2)$$;
revoke all on function private.admin_save_place(uuid,jsonb) from public,anon;
grant execute on function private.admin_save_place(uuid,jsonb) to authenticated;

create function private.valid_product_images(images jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select jsonb_typeof(images)='array' and jsonb_array_length(images) between 1 and 8 and not exists(
 select 1 from jsonb_array_elements(images) i where jsonb_typeof(i)<>'object' or length(coalesce(i->>'alt',''))>300
 or not (coalesce(i->>'src','') ~ '^/merch/images/[a-zA-Z0-9_-]+\.(png|webp|jpg|jpeg)$'
 or exists(select 1 from public.media m where '/api/media/'||m.id::text||'/'=i->>'src' and m.bucket='destination-public' and m.status='ready')))
$$;
revoke all on function private.valid_product_images(jsonb) from public;
grant execute on function private.valid_product_images(jsonb) to anon,authenticated,service_role;
create table public.merch_products(
 id integer generated by default as identity primary key,
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=160),
 name text not null check(length(name) between 1 and 200),
 sku text not null unique check(length(sku) between 1 and 80),
 description text not null default '' check(length(description)<=10000),
 category text not null check(length(category) between 1 and 80),
 price_centavos integer not null check(price_centavos between 0 and 100000000),
 compare_at_centavos integer check(compare_at_centavos>=price_centavos and compare_at_centavos<=100000000),
 status text not null default 'draft' check(status in ('draft','publish','archived')),
 featured boolean not null default false,
 images jsonb not null check(private.valid_product_images(images)),
 content jsonb not null default '{}' check(jsonb_typeof(content)='object' and octet_length(content::text)<=30000),
 version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.merch_variants(
 id uuid primary key default gen_random_uuid(),product_id integer not null references public.merch_products(id) on delete restrict,
 sku text not null unique check(length(sku) between 1 and 80),label text not null check(length(label) between 1 and 100),
 price_centavos integer not null check(price_centavos between 0 and 100000000),
 stock integer check(stock between 0 and 1000000),active boolean not null default true,
 unique(product_id,label)
);
create index products_admin on public.merch_products(status,updated_at desc,id);
create index variants_product on public.merch_variants(product_id,id);
alter table public.merch_products enable row level security;
alter table public.merch_variants enable row level security;
grant select on public.merch_products,public.merch_variants to anon,authenticated;
grant all on public.merch_products,public.merch_variants to service_role;
grant usage,select on sequence public.merch_products_id_seq to service_role;
create policy products_read on public.merch_products for select to anon,authenticated using(status='publish' or (select private.is_admin()));
create policy variants_read on public.merch_variants for select to anon,authenticated using((select private.is_admin()) or (active and exists(select 1 from public.merch_products p where p.id=product_id and p.status='publish')));
create trigger products_timestamp before update on public.merch_products for each row execute function private.touch_updated();
create trigger products_audit after insert or update on public.merch_products for each row execute function private.audit_change();
create trigger variants_audit after insert or update on public.merch_variants for each row execute function private.audit_change();

create function private.admin_save_product(pid integer,expected_version integer,body jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare product public.merch_products; v jsonb; vid uuid; keep_ids uuid[]:='{}';
begin
 if not private.is_admin() then raise exception 'MFA owner required' using errcode='42501'; end if;
 if jsonb_typeof(body->'variants') is distinct from 'array' or jsonb_array_length(body->'variants') not between 1 and 50 then raise exception 'Supply 1 to 50 variants' using errcode='22023'; end if;
 if pid is not null then
   select * into product from public.merch_products where id=pid for update;
   if product.id is null then raise sqlstate 'PT404' using message='Product unavailable'; end if;
   if product.version is distinct from expected_version then raise sqlstate 'PT409' using message='Product changed. Reload before saving.'; end if;
 end if;
 if pid is null then
   insert into public.merch_products(slug,name,sku,description,category,price_centavos,compare_at_centavos,status,featured,images,content)
   values(body->>'slug',body->>'name',body->>'sku',coalesce(body->>'description',''),body->>'category',(body->>'price_centavos')::integer,(body->>'compare_at_centavos')::integer,body->>'status',coalesce((body->>'featured')::boolean,false),body->'images',coalesce(body->'content','{}')) returning id into pid;
 else
   update public.merch_products set slug=body->>'slug',name=body->>'name',sku=body->>'sku',description=coalesce(body->>'description',''),category=body->>'category',price_centavos=(body->>'price_centavos')::integer,compare_at_centavos=(body->>'compare_at_centavos')::integer,status=body->>'status',featured=coalesce((body->>'featured')::boolean,false),images=body->'images',content=coalesce(body->'content','{}'),version=version+1 where id=pid;
 end if;
 for v in select value from jsonb_array_elements(body->'variants') loop
   vid=coalesce(nullif(v->>'id','')::uuid,gen_random_uuid());
   if exists(select 1 from public.merch_variants where id=vid and product_id<>pid) then raise exception 'Variant belongs to another product' using errcode='42501'; end if;
   insert into public.merch_variants(id,product_id,sku,label,price_centavos,stock,active)
   values(vid,pid,v->>'sku',v->>'label',(v->>'price_centavos')::integer,(v->>'stock')::integer,coalesce((v->>'active')::boolean,true))
   on conflict(id) do update set sku=excluded.sku,label=excluded.label,price_centavos=excluded.price_centavos,stock=excluded.stock,active=excluded.active;
   keep_ids=array_append(keep_ids,vid);
 end loop;
 update public.merch_variants set active=false where product_id=pid and not(id=any(keep_ids)) and active;
 return pid;
end $$;
create function public.admin_save_product(pid integer,expected_version integer,body jsonb) returns integer language sql volatile security invoker set search_path='' as $$select private.admin_save_product($1,$2,$3)$$;
revoke all on function private.admin_save_product(integer,integer,jsonb),public.admin_save_product(integer,integer,jsonb) from public,anon;
grant execute on function private.admin_save_product(integer,integer,jsonb),public.admin_save_product(integer,integer,jsonb) to authenticated;

-- Checkout remains disabled. Trusted server code may prepare sandbox orders.
create table public.merch_orders(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete restrict,
 idempotency_key uuid not null unique, currency text not null default 'PHP' check(currency='PHP'),
 total_centavos bigint not null check(total_centavos>=0),refunded_centavos bigint not null default 0 check(refunded_centavos>=0 and refunded_centavos<=total_centavos),
 payment_status text not null default 'pending' check(payment_status in ('pending','paid','partially_refunded','refunded','failed','expired')),
 fulfillment_status text not null default 'unfulfilled' check(fulfillment_status in ('unfulfilled','processing','shipped','delivered','cancelled')),
 provider_session_id text unique,provider_payment_id text unique,livemode boolean not null default false check(not livemode),
 internal_note text not null default '' check(length(internal_note)<=2000),
 paid_at timestamptz,version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.merch_order_items(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.merch_orders(id) on delete restrict,
 product_id integer not null references public.merch_products(id) on delete restrict,variant_id uuid not null references public.merch_variants(id) on delete restrict,
 product_name text not null,variant_label text not null,sku text not null,quantity integer not null check(quantity between 1 and 99),
 unit_centavos integer not null check(unit_centavos>=0),unique(order_id,variant_id)
);
create table public.merch_payment_events(
 provider_event_id text primary key,order_id uuid not null references public.merch_orders(id) on delete restrict,
 event_type text not null check(event_type in ('paid','refund')),payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
 amount_centavos bigint not null check(amount_centavos>=0),created_at timestamptz not null default now()
);
create index orders_recent on public.merch_orders(created_at desc,id);
create index orders_customer on public.merch_orders(user_id,created_at desc);
create index order_items_order on public.merch_order_items(order_id);
create index order_items_product on public.merch_order_items(product_id);
create index order_items_variant on public.merch_order_items(variant_id);
create index merch_payment_order on public.merch_payment_events(order_id);
alter table public.merch_orders enable row level security;
alter table public.merch_order_items enable row level security;
alter table public.merch_payment_events enable row level security;
grant select on public.merch_orders,public.merch_order_items,public.merch_payment_events to authenticated;
grant all on public.merch_orders,public.merch_order_items,public.merch_payment_events to service_role;
create policy orders_ops on public.merch_orders for select to authenticated using((select private.can_manage_orders()));
create policy order_items_ops on public.merch_order_items for select to authenticated using((select private.can_manage_orders()));
create policy order_events_owner on public.merch_payment_events for select to authenticated using((select private.is_admin()));
create trigger orders_timestamp before update on public.merch_orders for each row execute function private.touch_updated();
create trigger orders_audit after insert or update on public.merch_orders for each row execute function private.audit_change();

create function private.admin_fulfill_order(oid uuid,expected_version integer,state text,note text) returns void language plpgsql security definer set search_path='' as $$
declare o public.merch_orders;
begin
 if not private.can_manage_orders() then raise exception 'MFA order permission required' using errcode='42501'; end if;
 select * into o from public.merch_orders where id=oid for update;
 if o.id is null then raise sqlstate 'PT404' using message='Order unavailable'; end if;
 if o.version is distinct from expected_version then raise sqlstate 'PT409' using message='Order changed. Reload before saving.'; end if;
 if state<>o.fulfillment_status and not (
   (o.payment_status in ('paid','partially_refunded') and ((o.fulfillment_status='unfulfilled' and state='processing') or (o.fulfillment_status='processing' and state='shipped') or (o.fulfillment_status='shipped' and state='delivered')))
   or (state='cancelled' and o.fulfillment_status in ('unfulfilled','processing') and o.payment_status in ('pending','failed','expired','refunded')))
 then raise exception 'Payment and fulfillment transition do not permit this change' using errcode='22023'; end if;
 update public.merch_orders set fulfillment_status=state,internal_note=note,version=version+1 where id=oid;
end $$;
create function public.admin_fulfill_order(oid uuid,expected_version integer,state text,note text) returns void language sql volatile security invoker set search_path='' as $$select private.admin_fulfill_order($1,$2,$3,$4)$$;
revoke all on function private.admin_fulfill_order(uuid,integer,text,text),public.admin_fulfill_order(uuid,integer,text,text) from public,anon;
grant execute on function private.admin_fulfill_order(uuid,integer,text,text),public.admin_fulfill_order(uuid,integer,text,text) to authenticated;

create function private.prepare_merch_order(customer uuid,request_key uuid,lines jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare oid uuid; total bigint; line jsonb; v public.merch_variants;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Trusted checkout only' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(request_key::text,0));
 select id into oid from public.merch_orders where idempotency_key=request_key and user_id=customer;
 if oid is not null then return oid; end if;
 if jsonb_typeof(lines) is distinct from 'array' or jsonb_array_length(lines) not between 1 and 30 then raise exception 'Invalid order lines' using errcode='22023'; end if;
 perform 1 from public.merch_variants where id in(select (x->>'variant_id')::uuid from jsonb_array_elements(lines) x) order by id for update;
 total=0;
 for line in select value from jsonb_array_elements(lines) loop
   select * into v from public.merch_variants where id=(line->>'variant_id')::uuid and active;
   if v.id is null or v.stock is null or v.stock<(line->>'quantity')::integer or (line->>'quantity')::integer not between 1 and 99 or not exists(select 1 from public.merch_products where id=v.product_id and status='publish') then raise exception 'Variant unavailable or inventory unconfirmed' using errcode='22023'; end if;
   total=total+v.price_centavos::bigint*(line->>'quantity')::integer;
 end loop;
 insert into public.merch_orders(user_id,idempotency_key,total_centavos) values(customer,request_key,total) returning id into oid;
 insert into public.merch_order_items(order_id,product_id,variant_id,product_name,variant_label,sku,quantity,unit_centavos)
 select oid,mv.product_id,mv.id,p.name,mv.label,mv.sku,(x->>'quantity')::integer,mv.price_centavos from jsonb_array_elements(lines) x join public.merch_variants mv on mv.id=(x->>'variant_id')::uuid join public.merch_products p on p.id=mv.product_id;
 return oid;
end $$;
create function public.prepare_merch_order(customer uuid,request_key uuid,lines jsonb) returns uuid language sql volatile security invoker set search_path='' as $$select private.prepare_merch_order($1,$2,$3)$$;
revoke all on function private.prepare_merch_order(uuid,uuid,jsonb),public.prepare_merch_order(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.prepare_merch_order(uuid,uuid,jsonb),public.prepare_merch_order(uuid,uuid,jsonb) to service_role;

create function private.confirm_merch_payment(oid uuid,event_id text,payment_id text,amount bigint,event_hash text,refund_total bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.merch_orders;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Trusted provider confirmation only' using errcode='42501'; end if;
 select * into o from public.merch_orders where id=oid for update;
 if o.id is null or o.livemode or o.provider_session_id is null then raise exception 'Unmatched sandbox order' using errcode='22023'; end if;
 if exists(select 1 from public.merch_payment_events where provider_event_id=event_id) then
   if not exists(select 1 from public.merch_payment_events where provider_event_id=event_id and order_id=oid and payload_hash=event_hash) then raise exception 'Event identity mismatch' using errcode='22023'; end if;
   return jsonb_build_object('duplicate',true);
 end if;
 if refund_total is null then
   if o.payment_status='paid' and o.provider_payment_id=payment_id then return jsonb_build_object('duplicate',true); end if;
   if o.total_centavos<>amount or o.payment_status<>'pending' or o.fulfillment_status='cancelled' then raise exception 'Payment mismatch' using errcode='22023'; end if;
   perform 1 from public.merch_variants where id in(select variant_id from public.merch_order_items where order_id=oid) order by id for update;
   if exists(select 1 from public.merch_order_items i join public.merch_variants v on v.id=i.variant_id where i.order_id=oid and (v.stock is null or v.stock<i.quantity)) then raise exception 'Insufficient stock: reconcile payment before fulfillment' using errcode='22023'; end if;
   update public.merch_variants v set stock=v.stock-i.quantity from public.merch_order_items i where i.order_id=oid and i.variant_id=v.id;
   update public.merch_orders set payment_status='paid',provider_payment_id=payment_id,paid_at=now(),version=version+1 where id=oid;
 else
   if o.provider_payment_id is distinct from payment_id or o.payment_status not in ('paid','partially_refunded','refunded') or refund_total<o.refunded_centavos or refund_total>o.total_centavos or amount<>o.total_centavos then raise exception 'Refund mismatch' using errcode='22023'; end if;
   update public.merch_orders set refunded_centavos=refund_total,payment_status=case when refund_total=total_centavos then 'refunded' else 'partially_refunded' end,version=version+1 where id=oid;
 end if;
 insert into public.merch_payment_events(provider_event_id,order_id,event_type,payload_hash,amount_centavos) values(event_id,oid,case when refund_total is null then 'paid' else 'refund' end,event_hash,coalesce(refund_total,amount));
 return jsonb_build_object('duplicate',false);
end $$;
create function public.confirm_merch_payment(oid uuid,event_id text,payment_id text,amount bigint,event_hash text,refund_total bigint default null) returns jsonb language sql volatile security invoker set search_path='' as $$select private.confirm_merch_payment($1,$2,$3,$4,$5,$6)$$;
revoke all on function private.confirm_merch_payment(uuid,text,text,bigint,text,bigint),public.confirm_merch_payment(uuid,text,text,bigint,text,bigint) from public,anon,authenticated;
grant execute on function private.confirm_merch_payment(uuid,text,text,bigint,text,bigint),public.confirm_merch_payment(uuid,text,text,bigint,text,bigint) to service_role;

-- Consent-based minimal event store. No identities, IPs, notes or arbitrary payloads.
create table public.analytics_events(
 event_id uuid primary key,session_id uuid not null,
 name text not null check(name in ('place_viewed','place_saved','place_removed_from_bucketlist','place_added_to_itinerary','itinerary_created','product_viewed','product_added_to_bag','checkout_started','order_paid')),
 place_id uuid references public.places(id) on delete set null,product_id integer references public.merch_products(id) on delete set null,
 at timestamptz not null default now(),day date not null default (now() at time zone 'Asia/Manila')::date,
 check(not(place_id is not null and product_id is not null))
);
create index analytics_period on public.analytics_events(day,name);
create index analytics_place on public.analytics_events(place_id,day) where place_id is not null;
create index analytics_product on public.analytics_events(product_id,day) where product_id is not null;
create unique index analytics_view_once on public.analytics_events(session_id,name,coalesce(place_id::text,product_id::text,''),day) where name in ('place_viewed','product_viewed');
alter table public.analytics_events enable row level security;
grant select on public.analytics_events to authenticated;
grant all on public.analytics_events to service_role;
create policy analytics_owner on public.analytics_events for select to authenticated using((select private.is_admin()));

-- New tables explicitly opt into access; no default hosted grants may weaken it.
revoke insert,update,delete on public.merch_products,public.merch_variants,public.merch_orders,public.merch_order_items,public.merch_payment_events,public.analytics_events from anon,authenticated;
revoke select on public.merch_orders,public.merch_order_items,public.merch_payment_events,public.analytics_events from anon;

create function private.admin_sales_summary(first_day date,last_day date) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can_manage_orders() then raise exception 'MFA order permission required' using errcode='42501'; end if;
 if first_day is null or last_day is null or last_day<first_day or last_day-first_day>366 then raise exception 'Invalid period' using errcode='22023'; end if;
 return jsonb_build_object(
 'net_centavos',(select coalesce(sum(total_centavos-refunded_centavos),0) from public.merch_orders where paid_at>=first_day::timestamp at time zone 'Asia/Manila' and paid_at<(last_day+1)::timestamp at time zone 'Asia/Manila' and payment_status in ('paid','partially_refunded','refunded')),
 'paid_orders',(select count(*) from public.merch_orders where paid_at>=first_day::timestamp at time zone 'Asia/Manila' and paid_at<(last_day+1)::timestamp at time zone 'Asia/Manila' and payment_status in ('paid','partially_refunded','refunded')),
 'pending_orders',(select count(*) from public.merch_orders where payment_status='pending'),
 'refunded_orders',(select count(*) from public.merch_orders where paid_at>=first_day::timestamp at time zone 'Asia/Manila' and paid_at<(last_day+1)::timestamp at time zone 'Asia/Manila' and payment_status in ('partially_refunded','refunded')),
 'membership_paid_centavos',case when private.is_admin() then (select coalesce(sum(amount_centavos),0) from public.payment_transactions where status='paid' and paid_at>=first_day::timestamp at time zone 'Asia/Manila' and paid_at<(last_day+1)::timestamp at time zone 'Asia/Manila') else null end,
 'best_sellers',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select i.product_name,sum(i.quantity)::bigint units from public.merch_order_items i join public.merch_orders o on o.id=i.order_id where o.payment_status='paid' and o.paid_at>=first_day::timestamp at time zone 'Asia/Manila' and o.paid_at<(last_day+1)::timestamp at time zone 'Asia/Manila' group by i.product_id,i.product_name order by units desc,i.product_name limit 10) r));
end $$;
create function public.admin_sales_summary(first_day date,last_day date) returns jsonb language sql stable security invoker set search_path='' as $$select private.admin_sales_summary($1,$2)$$;
revoke all on function private.admin_sales_summary(date,date),public.admin_sales_summary(date,date) from public,anon;
grant execute on function private.admin_sales_summary(date,date),public.admin_sales_summary(date,date) to authenticated;

create function private.admin_analytics(first_day date,last_day date) returns jsonb language plpgsql stable security definer set search_path='' as $$
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
 'products',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select p.id,p.name,count(*) filter(where e.name='product_viewed') views,count(*) filter(where e.name='product_added_to_bag') bag_additions from period e join public.merch_products p on p.id=e.product_id group by p.id order by views desc,p.name limit 20) t),
 'current_saves',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select p.title,count(*) saves from public.member_places m join public.places p on p.id=m.place_id where m.saved_at is not null group by p.id order by saves desc,p.title limit 10) t),
 'current_planned',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select p.title,count(*) stops from public.itinerary_items i join public.places p on p.id=i.place_id group by p.id order by stops desc,p.title limit 10) t)
 ) into result;
 return result;
end $$;
create function public.admin_analytics(first_day date,last_day date) returns jsonb language sql stable security invoker set search_path='' as $$select private.admin_analytics($1,$2)$$;
revoke all on function private.admin_analytics(date,date),public.admin_analytics(date,date) from public,anon;
grant execute on function private.admin_analytics(date,date),public.admin_analytics(date,date) to authenticated;

create function private.admin_review_history(rid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_staff() then raise exception 'MFA content permission required' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select actor_id,action,at,summary from public.audit_logs where table_name='reviews' and record_id=rid::text order by at desc limit 30) r);
end $$;
create function public.admin_review_history(rid uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.admin_review_history($1)$$;
revoke all on function private.admin_review_history(uuid),public.admin_review_history(uuid) from public,anon;
grant execute on function private.admin_review_history(uuid),public.admin_review_history(uuid) to authenticated;
commit;
