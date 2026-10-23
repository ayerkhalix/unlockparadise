begin;
-- viewer_access is a public invoker RPC. Its predicate reveals only the caller's
-- own validated AAL/role result and must remain callable for anonymous clients.
grant execute on function private.can_manage_orders() to anon,service_role;
commit;
