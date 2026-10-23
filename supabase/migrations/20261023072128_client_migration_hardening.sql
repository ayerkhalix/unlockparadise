begin;
-- Internal rate limiting is reachable only through the service-role function.
-- Deny direct table reads as an additional boundary in the unexposed schema.
alter table private.rate_limits enable row level security;

-- This event-trigger helper is never an application RPC. Preserve its owner
-- behavior while removing the inherited PUBLIC execution grant from the dump.
do $$ begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  execute 'revoke all on function public.rls_auto_enable() from public,anon,authenticated';
 end if;
end $$;
commit;
