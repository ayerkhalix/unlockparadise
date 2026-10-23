-- Unlock Paradise normalized domain. Apply only to an isolated Supabase project.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon, service_role;

create table public.areas (
  id uuid primary key default gen_random_uuid(), legacy_id bigint unique,
  slug text not null unique, name text not null, description text not null default '',
  latitude numeric(12,9), longitude numeric(12,9), visible boolean not null default true,
  display_order integer not null default 0, metadata jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(latitude between -90 and 90), check(longitude between -180 and 180)
);
create table public.categories (
  id uuid primary key default gen_random_uuid(), legacy_id bigint unique,
  slug text not null unique, name text not null, description text not null default '',
  display_order integer not null default 0, metadata jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.places (
  id uuid primary key default gen_random_uuid(), legacy_id bigint unique,
  slug text not null unique check(length(slug) between 1 and 240),
  title text not null check(length(title) between 1 and 300),
  status text not null default 'draft' check(status in ('draft','publish','archived')),
  vip_content boolean not null default false, premium_content boolean not null default false,
  listing_types text[] not null default '{destination}' check(listing_types <@ array['destination','lot']::text[] and cardinality(listing_types)>0),
  travel_minutes numeric check(travel_minutes>=0), accessibility text[] not null default '{}',
  assets text[] not null default '{}', featured boolean not null default false, feature_order integer not null default 0,
  published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.place_details (
  place_id uuid primary key references public.places(id) on delete cascade,
  content text not null default '', description text not null default '', excerpt text not null default '',
  latitude numeric(12,9), longitude numeric(12,9), weekday_crowd text not null default '', weekend_crowd text not null default '',
  seo jsonb not null default '{}', legacy_fields jsonb not null default '{}',
  check(latitude between -90 and 90), check(longitude between -180 and 180),
  check((latitude is null) = (longitude is null))
);
create table public.place_areas (
  place_id uuid references public.places(id) on delete cascade, area_id uuid references public.areas(id) on delete restrict,
  primary key(place_id,area_id)
);
create table public.place_categories (
  place_id uuid references public.places(id) on delete cascade, category_id uuid references public.categories(id) on delete restrict,
  primary key(place_id,category_id)
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  legacy_id bigint unique, display_name text not null default 'Explorer' check(length(display_name) between 2 and 40),
  avatar_preset text not null default 'palm' check(avatar_preset in ('palm','boat','island','shell','sunset','surfer','turtle','wave')),
  featured_place_id uuid references public.places(id) on delete set null,
  terms_accepted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check(role in ('admin','editor')), granted_at timestamptz not null default now()
);
create table public.membership_plans (
  id text primary key, label text not null, months integer not null check(months in (1,3,12)),
  amount_centavos integer not null check(amount_centavos>0), currency text not null default 'PHP' check(currency='PHP'),
  active boolean not null default true
);
insert into public.membership_plans values
  ('monthly','Billed monthly',1,5000,'PHP',true),
  ('quarterly','Billed quarterly',3,13500,'PHP',true),
  ('yearly','Billed annually',12,42000,'PHP',true);
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete restrict,
  plan_id text references public.membership_plans(id), kind text not null check(kind in ('once','subscription','manual')),
  status text not null check(status in ('pending','active','past_due','cancelled','lapsed','revoked','refunded')),
  provider text check(provider in ('paymongo','legacy','manual')), provider_plan_id text unique,
  paid_through timestamptz, legacy_data jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.entitlements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid unique references public.subscriptions(id) on delete restrict,
  source text not null check(source in ('payment','manual','legacy')),
  starts_at timestamptz not null default now(), expires_at timestamptz,
  revoked_at timestamptz, reason text not null check(length(reason)>0),
  created_at timestamptz not null default now(), check(expires_at is null or expires_at>starts_at),
  check(source <> 'payment' or (subscription_id is not null and expires_at is not null))
);
create table public.member_places (
  user_id uuid references public.profiles(id) on delete cascade, place_id uuid references public.places(id) on delete cascade,
  saved_at timestamptz, visited_at timestamptz, primary key(user_id,place_id),
  check(saved_at is not null or visited_at is not null)
);
create table public.reviews (
  id uuid primary key default gen_random_uuid(), legacy_id bigint unique,
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  author_name text not null check(length(author_name) between 1 and 80),
  rating integer not null check(rating between 1 and 5), title text not null default '' check(length(title)<=80),
  body text not null default '' check(length(body)<=10000),
  status text not null default 'approved' check(status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,place_id)
);
create table public.review_likes (
  review_id uuid references public.reviews(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade,
  primary key(review_id,user_id), created_at timestamptz not null default now()
);
create table public.media (
  id uuid primary key default gen_random_uuid(), legacy_id bigint unique,
  owner_id uuid references public.profiles(id) on delete cascade,
  bucket text not null check(bucket in ('destination-public','destination-private','profile-private')),
  object_path text not null check(object_path not like '%..%'), original_path text,
  mime_type text not null, byte_size bigint not null check(byte_size>=0), checksum text,
  width integer, height integer, alt text not null default '',
  status text not null default 'pending' check(status in ('pending','ready','rejected','missing')),
  metadata jsonb not null default '{}', created_at timestamptz not null default now(), unique(bucket,object_path)
);
create table public.place_media (
  place_id uuid references public.places(id) on delete cascade,
  media_id uuid references public.media(id) on delete restrict,
  kind text not null check(kind in ('cover','gallery')), position integer not null check(position>=0),
  primary key(place_id,kind,position)
);
create table public.taxonomy_media (
  media_id uuid references public.media(id) on delete restrict,
  area_id uuid references public.areas(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  check((area_id is null) <> (category_id is null)),
  unique(area_id,media_id), unique(category_id,media_id)
);
create table public.profile_media (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete restrict
);
create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete restrict,
  plan_id text not null references public.membership_plans(id), provider text not null default 'paymongo' check(provider='paymongo'),
  provider_session_id text unique, provider_payment_id text unique,
  idempotency_key uuid not null unique,
  amount_centavos integer not null check(amount_centavos>0), currency text not null default 'PHP' check(currency='PHP'),
  status text not null default 'creating' check(status in ('creating','pending','paid','failed','expired','refunded','partially_refunded')),
  checkout_url text, paid_at timestamptz, livemode boolean not null default false check(livemode=false),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index one_open_checkout on public.payment_transactions(user_id) where status in ('creating','pending');
create table public.payment_events (
  provider_event_id text primary key, event_type text not null, transaction_id uuid references public.payment_transactions(id),
  payload_hash text not null, processed_at timestamptz not null default now(), outcome text not null
);
create table public.membership_history (
  id bigint generated always as identity primary key, user_id uuid references public.profiles(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  action text not null, at timestamptz not null default now()
);
create table public.audit_logs (
  id bigint generated always as identity primary key, actor_id uuid, action text not null,
  table_name text not null, record_id text, at timestamptz not null default now()
);
create table public.app_settings (
  key text primary key check(key in ('place_gate','review_write_level','review_moderation','avatar_moderation','place_display','asset_descriptions')),
  value jsonb not null, updated_at timestamptz not null default now()
);
insert into public.app_settings(key,value) values
 ('place_gate','"walled"'),('review_write_level','"member"'),('review_moderation','"auto"'),('avatar_moderation','"auto"');
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(), name text not null check(length(name)<=100),
  email text not null check(length(email)<=254), message text not null check(length(message) between 1 and 10000),
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete cascade,
  template text not null check(template in ('welcome','extended','reminder','ended','contact')),
  dedupe_key text not null unique, data jsonb not null default '{}',
  status text not null default 'pending' check(status in ('pending','sent','failed')),
  attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(), sent_at timestamptz
);

create index places_feed on public.places(status,featured,feature_order,published_at desc);
create index places_search on public.places using gin(to_tsvector('simple',title));
create index places_listing on public.places using gin(listing_types);
create index place_areas_area on public.place_areas(area_id,place_id);
create index place_categories_category on public.place_categories(category_id,place_id);
create index place_media_media on public.place_media(media_id,place_id);
create index entitlements_user_time on public.entitlements(user_id,expires_at) where revoked_at is null;
create index subscriptions_owner on public.subscriptions(user_id,status);
create index reviews_public on public.reviews(place_id,status,created_at desc);
create index member_saved on public.member_places(user_id,saved_at desc) where saved_at is not null;
create index member_visited on public.member_places(user_id,visited_at desc) where visited_at is not null;
create index payments_owner on public.payment_transactions(user_id,created_at desc);
create index media_owner on public.media(owner_id);
create index notifications_pending on public.notification_outbox(next_attempt_at) where status='pending';

create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((auth.jwt()->>'aal')='aal2',false) and exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin')
$$;
create function private.is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((auth.jwt()->>'aal')='aal2',false) and exists(select 1 from public.user_roles where user_id=auth.uid() and role in ('admin','editor'))
$$;
create function private.has_premium() returns boolean language sql stable security definer set search_path='' as $$
 select private.is_staff() or exists(
 select 1 from public.entitlements e left join public.subscriptions s on s.id=e.subscription_id
 where e.user_id=auth.uid() and e.revoked_at is null and e.starts_at<=now()
 and (e.expires_at is null or e.expires_at>now())
 and (e.source in ('manual','legacy') or (s.status in ('active','cancelled') and s.paid_through>now())))
$$;
create function private.can_view_place(pid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.places p where p.id=pid and
 (private.is_staff() or (p.status='publish' and
 ((not p.vip_content and (auth.uid() is not null or (select value from public.app_settings where key='place_gate')='"public"'::jsonb))
 or (p.vip_content and private.has_premium())))))
$$;
create function public.viewer_access() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('premium',private.has_premium(),'staff',private.is_staff(),'admin',private.is_admin())
$$;
create function private.media_visible(mid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.media m where m.id=mid and (private.is_staff() or m.owner_id=auth.uid()
 or (m.status='ready' and (m.bucket='destination-public' or exists(
 select 1 from public.place_media pm where pm.media_id=m.id and private.can_view_place(pm.place_id))))))
$$;
create function private.touch_updated() returns trigger language plpgsql set search_path='' as $$
 begin new.updated_at=now(); return new; end $$;
create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 insert into public.audit_logs(actor_id,action,table_name,record_id)
 values(auth.uid(),tg_op,tg_table_name,coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id',to_jsonb(new)->>'key',to_jsonb(new)->>'user_id'));
 return coalesce(new,old);
 end $$;
create function private.on_signup() returns trigger language plpgsql security definer set search_path='' as $$
 begin insert into public.profiles(id,display_name) values(new.id,'Explorer') on conflict do nothing; return new; end $$;
create trigger create_profile after insert on auth.users for each row execute function private.on_signup();

do $$ declare t text; begin
 foreach t in array array['areas','categories','places','profiles','subscriptions','reviews','payment_transactions','app_settings'] loop
 execute format('create trigger touch_updated before update on public.%I for each row execute function private.touch_updated()',t);
 end loop;
 foreach t in array array['places','place_details','areas','categories','place_media','user_roles','subscriptions','entitlements','reviews','media','app_settings'] loop
 execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()',t);
 end loop;
 for t in select tablename from pg_tables where schemaname='public' loop
 execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;

-- Explicit grants; a policy alone never grants table privileges.
revoke all on all tables in schema public from anon,authenticated;
grant select on public.places,public.areas,public.categories,public.place_areas,public.place_categories,public.place_details,public.place_media,public.taxonomy_media,public.media,public.reviews,public.membership_plans to anon,authenticated;
grant select on public.app_settings to anon,authenticated;
grant select,insert,update,delete on public.profiles,public.member_places,public.review_likes,public.profile_media to authenticated;
grant insert,delete on public.reviews to authenticated;
grant select on public.user_roles,public.subscriptions,public.entitlements,public.payment_transactions,public.membership_history,public.audit_logs,public.payment_events,public.contact_messages,public.notification_outbox to authenticated;
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;

create policy published_places on public.places for select using(status='publish' or private.is_staff());
create policy public_areas on public.areas for select using(visible or private.is_staff());
create policy public_categories on public.categories for select using(true);
create policy place_areas_read on public.place_areas for select using(exists(select 1 from public.places p where p.id=place_id));
create policy place_categories_read on public.place_categories for select using(exists(select 1 from public.places p where p.id=place_id));
create policy details_read on public.place_details for select using(private.can_view_place(place_id));
create policy place_media_read on public.place_media for select using(private.can_view_place(place_id) or (kind='cover' and exists(select 1 from public.places where id=place_id and status='publish')));
create policy taxonomy_media_read on public.taxonomy_media for select using(private.media_visible(media_id));
create policy media_read on public.media for select using(private.media_visible(id));
create policy plans_read on public.membership_plans for select using(active or private.is_staff());
create policy settings_read on public.app_settings for select using(true);
create policy profile_read on public.profiles for select using(id=auth.uid() or private.is_admin());
create policy profile_update on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
revoke update on public.profiles from authenticated;
grant update(display_name,avatar_preset,featured_place_id,terms_accepted_at) on public.profiles to authenticated;
create policy roles_read on public.user_roles for select using(user_id=auth.uid() or private.is_admin());
create policy subscriptions_read on public.subscriptions for select using(user_id=auth.uid() or private.is_admin());
create policy entitlement_read on public.entitlements for select using(user_id=auth.uid() or private.is_admin());
create policy membership_history_read on public.membership_history for select using(user_id=auth.uid() or private.is_admin());
create policy payment_read on public.payment_transactions for select using(user_id=auth.uid() or private.is_admin());
create policy member_places_read on public.member_places for select using(user_id=auth.uid());
-- Writes go through atomic RPC: visit clears saved; RLS alone cannot enforce this transition.
revoke insert,update,delete on public.member_places from authenticated;
create policy reviews_read on public.reviews for select using(status='approved' or user_id=auth.uid() or private.is_staff());
create policy reviews_insert on public.reviews for insert with check(user_id=auth.uid() and private.can_view_place(place_id)
 and ((select value from public.app_settings where key='review_write_level')='"member"'::jsonb or private.has_premium()));
create policy reviews_delete on public.reviews for delete using(user_id=auth.uid());
create policy likes_read on public.review_likes for select to authenticated using(exists(select 1 from public.reviews r where r.id=review_id and r.status='approved'));
create policy likes_insert on public.review_likes for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.reviews r where r.id=review_id and r.status='approved'));
create policy likes_delete on public.review_likes for delete to authenticated using(user_id=auth.uid());
create policy profile_media_read on public.profile_media for select using(user_id=auth.uid() or private.is_staff());
revoke insert,update,delete on public.profile_media from authenticated;
create policy audit_read on public.audit_logs for select using(private.is_admin());
create policy events_read on public.payment_events for select using(private.is_admin());
create policy contacts_read on public.contact_messages for select using(private.is_admin());
create policy outbox_read on public.notification_outbox for select using(private.is_admin());

create function private.review_defaults() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if current_user <> 'service_role' and auth.uid() is not null then
 new.user_id=auth.uid();
 select display_name into new.author_name from public.profiles where id=auth.uid();
 new.status=case when (select value from public.app_settings where key='review_moderation')='"hold"'::jsonb then 'pending' else 'approved' end;
 new.created_at=now(); new.updated_at=now(); new.legacy_id=null;
 end if; return new;
 end $$;
create trigger review_defaults before insert on public.reviews for each row execute function private.review_defaults();
create function private.profile_feature_guard() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if new.featured_place_id is distinct from old.featured_place_id and new.featured_place_id is not null
 and not exists(select 1 from public.member_places where user_id=new.id and place_id=new.featured_place_id)
 then raise exception 'Pick a place from your own lists' using errcode='42501'; end if;
 return new; end $$;
create trigger profile_feature_guard before update on public.profiles for each row execute function private.profile_feature_guard();

create function public.set_member_place(pid uuid, op text) returns jsonb language plpgsql security definer set search_path='' as $$
 declare uid uuid:=auth.uid(); row_data public.member_places;
 begin
 if uid is null or not private.has_premium() then raise exception 'Explorer+ required' using errcode='42501'; end if;
 if not private.can_view_place(pid) then raise exception 'Place unavailable' using errcode='42501'; end if;
 if op not in ('save','unsave','visit','unvisit') then raise exception 'Invalid operation' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||pid::text,0));
 select * into row_data from public.member_places where user_id=uid and place_id=pid for update;
 if op='save' then row_data.saved_at=coalesce(row_data.saved_at,now()); end if;
 if op='unsave' then row_data.saved_at=null; end if;
 if op='visit' then row_data.visited_at=now(); row_data.saved_at=null; end if;
 if op='unvisit' then row_data.visited_at=null; end if;
 if row_data.saved_at is null and row_data.visited_at is null then delete from public.member_places where user_id=uid and place_id=pid;
 else insert into public.member_places values(uid,pid,row_data.saved_at,row_data.visited_at)
 on conflict(user_id,place_id) do update set saved_at=excluded.saved_at,visited_at=excluded.visited_at; end if;
 return jsonb_build_object('saved',row_data.saved_at is not null,'visited',row_data.visited_at is not null);
 end $$;

-- All functions default to no PUBLIC execute; grant only named entry points.
revoke all on all functions in schema private from public;
grant execute on function private.is_admin(),private.is_staff(),private.has_premium(),private.can_view_place(uuid),private.media_visible(uuid) to anon,authenticated,service_role;
revoke all on function public.viewer_access(),public.set_member_place(uuid,text) from public;
grant execute on function public.viewer_access() to anon,authenticated,service_role;
grant execute on function public.set_member_place(uuid,text) to authenticated;
commit;
