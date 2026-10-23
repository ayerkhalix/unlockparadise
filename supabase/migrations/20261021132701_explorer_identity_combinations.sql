begin;
-- Consolidate the old nine choices into the owner's six approved families.
create function private.normalize_traveler_interests(keys text[]) returns text[]
language sql immutable security invoker set search_path='' as $$
 select coalesce(array_agg(k order by n),'{}'::text[]) from unnest(array['beach','river','mountain','culture','food','coffee']) with ordinality canonical(k,n)
 where k=any(keys) or (k='beach' and 'island'=any(keys)) or (k='river' and ('waterfall'=any(keys) or 'nature'=any(keys))) or (k='mountain' and 'nature'=any(keys))
$$;
revoke all on function private.normalize_traveler_interests(text[]) from public,anon;
grant execute on function private.normalize_traveler_interests(text[]) to authenticated,service_role;
create or replace function private.traveler_categories(keys text[]) returns text[]
language sql immutable security invoker set search_path='' as $$
 select coalesce(array_agg(distinct category order by category),'{}'::text[]) from (
 select unnest(case k when 'beach' then array['beaches','islands'] when 'river' then array['rivers','waterfalls'] when 'mountain' then array['mountain-hikes'] when 'culture' then array['others'] when 'food' then array['restaurants'] when 'coffee' then array['coffee'] else '{}'::text[] end) category from unnest(private.normalize_traveler_interests(keys)) k) mapped
$$;
create or replace function private.traveler_archetype(keys text[], pace text, style text) returns text
language sql immutable security invoker set search_path='' as $$
 with selected as (select private.normalize_traveler_interests(keys) keys), identity as (
 select coalesce(sum(case when k=any(selected.keys) then (1::bigint << (n::int-1)) else 0 end),0)::int mask
 from selected,unnest(array['beach','river','mountain','culture','food','coffee']) with ordinality family(k,n))
 select case when mask=0 then 'curious-explorer' when mask=63 then 'wildcard' else 'identity-'||mask end from identity
$$;
alter table public.traveler_preferences drop constraint traveler_preferences_interests_check;
-- Updating each row also recomputes its stored identity and increments its version.
update public.traveler_preferences set interests=private.normalize_traveler_interests(interests);
alter table public.traveler_preferences add constraint traveler_preferences_interests_check check(interests <@ array['beach','river','mountain','culture','food','coffee']::text[] and cardinality(interests)<=6 and array_position(interests,null) is null);
-- Labels are metadata only; profiles, badges and aggregates use the same identity key.
create function public.traveler_identity_labels() returns jsonb language sql immutable security invoker set search_path='' as $$ select '{"1":"Coastal Wanderer","2":"Wildwater Adventurer","3":"Coast & Stream Chaser","4":"Trailblazer","5":"Coast-to-Peak Adventurer","6":"Wild Terrain Adventurer","7":"The Wild Terrain Chaser","8":"Man/Woman of Culture","9":"Coastal Culture Seeker","10":"Riverside Culture Seeker","11":"Coastal & River Rambler","12":"Highland Culture Seeker","13":"Coast-to-Peak Soul Seeker","14":"Wilderness Soul Seeker","15":"The Wild Culture Wanderer","16":"Food Connoisseur","17":"Coastal Foodie","18":"Wildwater Foodie","19":"Coast & Current Foodie","20":"Trail & Table Explorer","21":"Coast-to-Trail Foodie","22":"Nature-Flavor Seeker","23":"The All-Terrain Foodie","24":"Local Flavor Hunter","25":"Coastal Flavor Explorer","26":"Riverside Flavor Explorer","27":"Coastal & Wild Flavor Seeker","28":"Highland Flavor Explorer","29":"Coast-to-Peak Flavor Seeker","30":"Cultural Nomad","31":"Rogue Explorer","32":"Brew Chaser","33":"Beachside Brew Chaser","34":"Riverside Brew Roamer","35":"Coast & Current Brew Chaser","36":"Peak & Pour Explorer","37":"Coast-to-Peak Coffee Lover","38":"Peaks & Brews Explorer","39":"The All-Terrain Brew Chaser","40":"Culture & Coffee Roamer","41":"Coastal Culture & Brew Explorer","42":"Riverside Soul Seeker","43":"Coastal & Wild Culture Roamer","44":"Cultural Soul Seeker","45":"Coast-to-Peak Soul Seeker","46":"Cultural Thrill Seeker","47":"The All-Terrain Blazer","48":"The Connoisseur","49":"Coastal Connoisseur","50":"Wildwater Flavor Chaser","51":"Coast-to-Wildwater Connoisseur","52":"Highland Connoisseur","53":"Coast-to-Trail Connoisseur","54":"Wild Terrain Connoisseur","55":"The Paradise Farmer","56":"Man/Woman of Culture & Flavor","57":"Coastal Culture Connoisseur","58":"Cultural Connoisseur","59":"The Coastal & Wildwater Connoisseur","60":"Highland Culture Connoisseur","61":"The Coast-to-Peak Nomad","62":"The Inland All-Rounder","63":"The Wildcard"}'::jsonb $$;
revoke all on function public.traveler_identity_labels() from public;
grant execute on function public.traveler_identity_labels() to anon,authenticated,service_role;
commit;
