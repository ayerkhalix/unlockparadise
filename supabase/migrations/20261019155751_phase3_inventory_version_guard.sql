-- Keep inventory changes visible to optimistic catalog saves. Lock parents before variants.
begin;
create or replace function private.confirm_merch_payment(oid uuid,event_id text,payment_id text,amount bigint,event_hash text,refund_total bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
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
   perform p.id from public.merch_products p where p.id in(select product_id from public.merch_order_items where order_id=oid) order by p.id for update;
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

create function private.inventory_product_version() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.merch_products set version=version+1 where id=new.product_id;
 return new;
end $$;
revoke all on function private.inventory_product_version() from public,anon,authenticated;
create trigger inventory_product_version after update of stock on public.merch_variants for each row when(old.stock is distinct from new.stock) execute function private.inventory_product_version();

commit;
