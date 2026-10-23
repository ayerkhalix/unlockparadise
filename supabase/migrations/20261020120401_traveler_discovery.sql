begin;

-- Stable category slugs are the existing taxonomy, never new disconnected terms.
create function private.traveler_categories(keys text[]) returns text[]
language sql immutable security invoker set search_path='' as $$
 select coalesce(array_agg(distinct category order by category),'{}'::text[]) from (
 select unnest(case k when 'beach' then array['beaches'] when 'island' then array['islands']
 when 'mountain' then array['mountain-hikes'] when 'river' then array['rivers']
 when 'waterfall' then array['waterfalls'] when 'food' then array['restaurants']
 when 'coffee' then array['coffee'] when 'culture' then array['others']
 when 'nature' then array['rivers','waterfalls','mountain-hikes'] else '{}'::text[] end) category
 from unnest(keys) k) mapped
$$;
create function private.traveler_archetype(keys text[], pace text, style text) returns text
language sql immutable security invoker set search_path='' as $$
 select case when cardinality(keys)=0 or cardinality(keys)>=5 then 'curious-explorer'
 else (select name from (values
 ('coastal-dreamer',1,3*('beach'=any(keys))::int+('island'=any(keys))::int+coalesce((style='scenic')::int,0)+2*coalesce((pace='slow')::int,0)),
 ('trailblazer',2,4*('mountain'=any(keys))::int+('nature'=any(keys))::int+3*coalesce((style='outdoor')::int,0)+2*coalesce((pace='adventure')::int,0)),
 ('island-wanderer',3,4*('island'=any(keys))::int+('beach'=any(keys))::int+('nature'=any(keys))::int+2*coalesce((style='hidden')::int,0)),
 ('nature-seeker',4,3*('river'=any(keys))::int+3*('waterfall'=any(keys))::int+4*('nature'=any(keys))::int+coalesce((style='scenic')::int,0)),
 ('local-foodie',5,4*('food'=any(keys))::int+3*('coffee'=any(keys))::int+('culture'=any(keys))::int+3*coalesce((style='food')::int,0)),
 ('curious-explorer',6,1+2*coalesce((style='everything')::int,0))
 ) scores(name,tie,score) order by score desc,tie limit 1) end
$$;
revoke all on function private.traveler_categories(text[]),private.traveler_archetype(text[],text,text) from public,anon;
grant execute on function private.traveler_categories(text[]),private.traveler_archetype(text[],text,text) to authenticated,service_role;

create table public.traveler_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 interests text[] not null default '{}' check(interests <@ array['beach','island','mountain','river','waterfall','food','coffee','culture','nature']::text[] and cardinality(interests)<=9 and array_position(interests,null) is null),
 pace text check(pace in ('slow','balanced','adventure')),
 style text check(style in ('hidden','scenic','outdoor','food','everything')),
 companion text check(companion in ('solo','partner','friends','family','depends')),
 public_badges boolean not null default false,
 status text not null default 'pending' check(status in ('pending','completed','skipped','dismissed')),
 archetype text generated always as (private.traveler_archetype(interests,pace,style)) stored,
 version integer not null default 0 check(version>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.traveler_preferences enable row level security;
revoke all on public.traveler_preferences from anon,authenticated;
grant select,insert,update on public.traveler_preferences to authenticated;
grant all on public.traveler_preferences to service_role;
create policy traveler_own_read on public.traveler_preferences for select to authenticated using(user_id=(select auth.uid()));
create policy traveler_own_insert on public.traveler_preferences for insert to authenticated with check(user_id=(select auth.uid()));
create policy traveler_own_update on public.traveler_preferences for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

-- Both direct Data API writes and RPC writes receive the same invariants/version.
create function private.traveler_write_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if cardinality(new.interests)<>(select count(distinct k) from unnest(new.interests) k) then raise check_violation using message='Choose each interest once.'; end if;
 if tg_op='UPDATE' then new.created_at=old.created_at; new.version=old.version+1; else new.version=0; end if;
 if new.status<>'completed' then new.public_badges=false; end if;
 new.updated_at=now(); return new;
end $$;
create trigger traveler_write_guard before insert or update on public.traveler_preferences for each row execute function private.traveler_write_guard();
revoke all on function private.traveler_write_guard() from public,anon,authenticated;

-- Only future profiles get pending onboarding. Existing accounts receive no backfill.
create function private.start_traveler_discovery() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.traveler_preferences(user_id) values(new.id); return new; end $$;
revoke all on function private.start_traveler_discovery() from public,anon,authenticated,service_role;
create trigger start_traveler_discovery after insert on public.profiles for each row execute function private.start_traveler_discovery();

create function private.save_traveler_preferences(body jsonb, expected_version integer) returns public.traveler_preferences
language plpgsql volatile security invoker set search_path='' as $$
declare saved public.traveler_preferences; action text:=body->>'op'; answer jsonb:=body->'answers'; keys text[];
begin
 if auth.uid() is null then raise insufficient_privilege using message='Sign in to continue.'; end if;
 if expected_version is null or expected_version<0 or action is null or action not in ('complete','skip','dismiss','clear') then raise check_violation using message='Invalid preference operation.'; end if;
 insert into public.traveler_preferences(user_id) values(auth.uid()) on conflict do nothing;
 select * into saved from public.traveler_preferences where user_id=auth.uid() for update;
 if saved.version<>expected_version then raise sqlstate 'PT409' using message='Preferences changed. Reload before saving.'; end if;
 if action='complete' then
   if jsonb_typeof(answer)<>'object' or jsonb_typeof(answer->'interests')<>'array' or jsonb_typeof(answer->'public_badges')<>'boolean'
      or not(answer ?& array['interests','pace','style','companion','public_badges'])
      or exists(select 1 from jsonb_object_keys(answer) k where k not in ('interests','pace','style','companion','public_badges'))
      or exists(select 1 from jsonb_array_elements(answer->'interests') k where jsonb_typeof(k)<>'string')
   then raise check_violation using message='Invalid travel answers.'; end if;
   select coalesce(array_agg(k),'{}'::text[]) into keys from jsonb_array_elements_text(answer->'interests') k;
   update public.traveler_preferences set interests=keys,pace=answer->>'pace',style=answer->>'style',companion=answer->>'companion',public_badges=(answer->>'public_badges')::boolean,status='completed' where user_id=auth.uid() returning * into saved;
 elsif action='dismiss' then
   if saved.status<>'completed' then update public.traveler_preferences set status='dismissed' where user_id=auth.uid() returning * into saved; end if;
 elsif action='clear' or saved.status<>'completed' then
   update public.traveler_preferences set interests='{}',pace=null,style=null,companion=null,public_badges=false,status='skipped' where user_id=auth.uid() returning * into saved;
 end if;
 return saved;
end $$;
create function public.save_traveler_preferences(body jsonb, expected_version integer) returns public.traveler_preferences
language sql volatile security invoker set search_path='' as $$ select private.save_traveler_preferences($1,$2) $$;
revoke all on function public.save_traveler_preferences(jsonb,integer),private.save_traveler_preferences(jsonb,integer) from public,anon;
grant execute on function public.save_traveler_preferences(jsonb,integer),private.save_traveler_preferences(jsonb,integer) to authenticated;

-- A narrow current-identity projection keyed by approved, viewable reviews only.
-- Private answers never acquire a public SELECT policy. No email/pace/style/companion.
create function private.public_traveler_badges(review_ids uuid[]) returns table(review_id uuid,archetype text,interests text[])
language sql stable security definer set search_path='' as $$
 select r.id,t.archetype, array(select k from unnest(t.interests) with ordinality i(k,n)
 order by exists(select 1 from public.place_categories pc join public.categories c on c.id=pc.category_id
 where pc.place_id=r.place_id and c.slug=any(private.traveler_categories(array[k]))) desc,n limit 2)
 from public.reviews r join public.traveler_preferences t on t.user_id=r.user_id
 where r.id=any(review_ids[1:100]) and r.status='approved' and private.can_view_place(r.place_id)
 and t.status='completed' and t.public_badges
$$;
create function public.public_traveler_badges(review_ids uuid[]) returns table(review_id uuid,archetype text,interests text[])
language sql stable security invoker set search_path='' as $$ select * from private.public_traveler_badges($1) $$;
revoke all on function public.public_traveler_badges(uuid[]),private.public_traveler_badges(uuid[]) from public;
grant execute on function public.public_traveler_badges(uuid[]),private.public_traveler_badges(uuid[]) to anon,authenticated,service_role;

-- RLS and the original entitlement function remain authoritative. Ranking reads a
-- small result set on the server; it never ships the catalog or private answers.
create function public.traveler_featured(max_results integer default 4) returns setof public.places
language sql stable security invoker set search_path='' as $$
 with prefs as (select interests,pace from public.traveler_preferences where user_id=(select auth.uid()) and status='completed' and cardinality(interests)>0),
 candidates as (
 select p.*, coalesce((select c.slug from public.place_categories pc join public.categories c on c.id=pc.category_id
 where pc.place_id=p.id and c.slug=any(private.traveler_categories(t.interests)) order by c.slug limit 1),'~editorial') match_category,
 (case when exists(select 1 from public.place_categories pc join public.categories c on c.id=pc.category_id where pc.place_id=p.id and c.slug=any(private.traveler_categories(t.interests))) then 20 else 0 end
 +case when p.featured then 4 else 0 end
 +case when exists(select 1 from public.place_details d where d.place_id=p.id and d.hike_minutes is not null and
 ((t.pace='adventure' and d.hike_minutes>=120) or (t.pace='slow' and d.hike_minutes<=60))) then 1 else 0 end) score
 from public.places p cross join prefs t where p.status='publish' and 'destination'=any(p.listing_types) and (not p.vip_content or private.has_premium())
 ), ranked as (select c.*,row_number() over(partition by match_category order by score desc,feature_order,published_at desc nulls last,id) category_position from candidates c)
 select p.* from ranked r join public.places p on p.id=r.id
 order by case when r.category_position=1 and r.score>=20 then 0 when r.category_position<=2 and r.score>=20 then 1 else 2 end,r.score desc,r.feature_order,r.published_at desc nulls last,r.id
 limit least(greatest(max_results,1),12)
$$;
revoke all on function public.traveler_featured(integer) from public,anon;
grant execute on function public.traveler_featured(integer) to authenticated;

-- Aggregate-only administration; suppress small cohorts rather than naming users.
create function private.traveler_discovery_stats() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare total bigint;
begin
 if auth.uid() is null or not private.is_admin() then raise insufficient_privilege using message='Administrator MFA required.'; end if;
 select count(*) into total from public.traveler_preferences where status='completed';
 if total<10 then return jsonb_build_object('available',false,'minimum',10); end if;
 return jsonb_build_object('available',true,'completed',total,'minimum',10,
 'interests',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select k as key,count(*) as count from public.traveler_preferences t cross join lateral unnest(t.interests) k where status='completed' group by k having count(*)>=5 order by count(*) desc,k) x),
 'archetypes',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select archetype as key,count(*) as count from public.traveler_preferences where status='completed' group by archetype having count(*)>=5 order by count(*) desc,archetype) x));
end $$;
create function public.traveler_discovery_stats() returns jsonb language sql stable security invoker set search_path='' as $$ select private.traveler_discovery_stats() $$;
revoke all on function public.traveler_discovery_stats(),private.traveler_discovery_stats() from public,anon;
grant execute on function public.traveler_discovery_stats(),private.traveler_discovery_stats() to authenticated;
commit;
