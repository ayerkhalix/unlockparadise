begin;
-- Only source-classified public teasers may be read without place access.
alter policy place_media_read on public.place_media using(
 private.can_view_place(place_id) or exists(
 select 1 from public.places p where p.id=place_id and p.status='publish' and
 (kind='cover' or exists(select 1 from public.media m where m.id=media_id and m.bucket='destination-public' and m.status in ('ready','legacy'))))
);
create index member_places_destination on public.member_places(place_id);
create index history_subscription on public.membership_history(subscription_id);
create index history_owner on public.membership_history(user_id);
create index notification_owner on public.notification_outbox(user_id);
create index event_transaction on public.payment_events(transaction_id);
create index payment_plan on public.payment_transactions(plan_id);
create index redirects_destination on public.place_redirects(place_id);
create index profile_photo_current on public.profile_media(media_id);
create index profile_photo_pending on public.profile_media(pending_media_id);
create index profile_featured_destination on public.profiles(featured_place_id);
create index likes_owner on public.review_likes(user_id);
create index subscription_plan on public.subscriptions(plan_id);
create index taxonomy_image on public.taxonomy_media(media_id);
-- Cache row-independent permission lookups once per query without changing rules.
do $$ declare p record; q text; c text; f text; statement text; begin
 for p in select * from pg_policies where schemaname='public' loop
 q=p.qual;c=p.with_check;
 foreach f in array array['auth.uid()','private.is_staff()','private.is_admin()','private.has_premium()'] loop
 q=replace(q,f,'(select '||f||')');c=replace(c,f,'(select '||f||')');
 end loop;
 statement=format('alter policy %I on public.%I',p.policyname,p.tablename);
 if q is not null then statement=statement||' using ('||q||')';end if;
 if c is not null then statement=statement||' with check ('||c||')';end if;
 execute statement;
 end loop;
end $$;
commit;
