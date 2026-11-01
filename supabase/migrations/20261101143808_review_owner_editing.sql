-- Owners can change review content only. Identity, approval and timestamps stay server-owned.
grant update(rating,title,body) on public.reviews to authenticated;
create policy reviews_owner_update on public.reviews for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()) and private.can_view_place(place_id)
 and ((select value from public.app_settings where key='review_write_level')='"member"'::jsonb or private.has_premium()));

create function private.review_edit_moderation() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 -- Staff already have table-level UPDATE grants. Keep that workflow while
 -- preventing the new owner policy from exposing approval or identity fields.
 if current_user in ('authenticated','anon') and not private.is_staff() and (
  new.id is distinct from old.id or new.user_id is distinct from old.user_id
  or new.place_id is distinct from old.place_id or new.author_name is distinct from old.author_name
  or new.legacy_id is distinct from old.legacy_id or new.created_at is distinct from old.created_at
  or new.status is distinct from old.status
 ) then
  raise exception 'Only review text and rating can be edited' using errcode='42501';
 end if;
 if new.rating is distinct from old.rating or new.title is distinct from old.title or new.body is distinct from old.body then
  new.status=case when (select value from public.app_settings where key='review_moderation')='"hold"'::jsonb then 'pending' else 'approved' end;
 end if;
 return new;
end $$;
revoke all on function private.review_edit_moderation() from public,anon,authenticated;
create trigger review_edit_moderation before update on public.reviews
for each row execute function private.review_edit_moderation();
