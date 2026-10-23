begin;

alter table public.merch_collections
  add column tagline text not null default ''
  check (tagline = btrim(tagline) and char_length(tagline) <= 160);

grant update (tagline) on public.merch_collections to authenticated;
create policy collection_tagline_update on public.merch_collections
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

update public.merch_collections set tagline = 'Find your way'
where id = '00000000-0000-4000-8000-000000000c01' and tagline = '';

commit;
