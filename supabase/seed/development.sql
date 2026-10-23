-- Explicit opt-in fixture only. Never load this seed into a content migration.
begin;
insert into public.areas(id,slug,name) values('30000000-0000-4000-8000-000000000001','synthetic-test-area','[TEST] Synthetic area') on conflict do nothing;
insert into public.categories(id,slug,name) values('30000000-0000-4000-8000-000000000002','synthetic-test-category','[TEST] Synthetic category') on conflict do nothing;
insert into public.places(id,slug,title,status) values('30000000-0000-4000-8000-000000000003','synthetic-test-place','[TEST] Synthetic draft Place','draft') on conflict do nothing;
insert into public.place_details(place_id,description) values('30000000-0000-4000-8000-000000000003','Synthetic test fixture. Not production content.') on conflict do nothing;
commit;
