begin;
-- Keep guarded privileged implementations outside the exposed Data API schema.
-- Public entry points use invoker privileges and retain the same argument/return contracts.
alter function public.admin_save_place(uuid,jsonb) set schema private;
create function public.admin_save_place(pid uuid, body jsonb) returns uuid language sql volatile security invoker set search_path='' as $$ select private.admin_save_place($1,$2) $$;
revoke all on function public.admin_save_place(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_save_place(uuid,jsonb),private.admin_save_place(uuid,jsonb) to authenticated;
alter function public.admin_delete_place(uuid,text) set schema private;
create function public.admin_delete_place(pid uuid, confirm_slug text) returns void language sql volatile security invoker set search_path='' as $$ select private.admin_delete_place($1,$2) $$;
revoke all on function public.admin_delete_place(uuid,text) from public,anon,authenticated;
grant execute on function public.admin_delete_place(uuid,text),private.admin_delete_place(uuid,text) to authenticated;
alter function public.admin_metrics() set schema private;
create function public.admin_metrics() returns jsonb language sql stable security invoker set search_path='' as $$ select private.admin_metrics() $$;
revoke all on function public.admin_metrics() from public,anon,authenticated;
grant execute on function public.admin_metrics(),private.admin_metrics() to authenticated;
alter function public.admin_prepare_media_delete(uuid) set schema private;
create function public.admin_prepare_media_delete(mid uuid) returns jsonb language sql volatile security invoker set search_path='' as $$ select private.admin_prepare_media_delete($1) $$;
revoke all on function public.admin_prepare_media_delete(uuid) from public,anon,authenticated;
grant execute on function public.admin_prepare_media_delete(uuid),private.admin_prepare_media_delete(uuid) to authenticated;
alter function public.set_member_place(uuid,text) set schema private;
create function public.set_member_place(pid uuid, op text) returns jsonb language sql volatile security invoker set search_path='' as $$ select private.set_member_place($1,$2) $$;
revoke all on function public.set_member_place(uuid,text) from public,anon,authenticated;
grant execute on function public.set_member_place(uuid,text),private.set_member_place(uuid,text) to authenticated;
alter function public.review_like_counts(uuid[]) set schema private;
create function public.review_like_counts(review_ids uuid[]) returns table(review_id uuid,likes bigint,liked boolean) language sql stable security invoker set search_path='' as $$ select * from private.review_like_counts($1) $$;
revoke all on function public.review_like_counts(uuid[]) from public,anon,authenticated;
grant execute on function public.review_like_counts(uuid[]),private.review_like_counts(uuid[]) to anon,authenticated,service_role;
commit;