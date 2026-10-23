begin;
-- Explicit client-review exception. No rows are seeded by migrations.
-- The verified token issuer pins exceptions to the isolated staging project.
create table private.staging_admin_mfa_exemptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null check(length(reason) between 1 and 500),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table private.staging_admin_mfa_exemptions enable row level security;
revoke all on private.staging_admin_mfa_exemptions from public,anon,authenticated,service_role;
create function private.has_admin_assurance() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((auth.jwt()->>'aal')='aal2',false) or (
   auth.uid() is not null
   and auth.jwt()->>'iss'='https://iitblbdqztuxdzpaetie.supabase.co/auth/v1'
   and exists(select 1 from private.staging_admin_mfa_exemptions e
     join public.user_roles r on r.user_id=e.user_id and r.role='admin'
     where e.user_id=auth.uid() and e.enabled)
 )
$$;
revoke all on function private.has_admin_assurance() from public,anon,authenticated,service_role;
-- Only existing permission functions call this private helper as their owner.
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select private.has_admin_assurance() and exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin')
$$;
create or replace function private.is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select private.has_admin_assurance() and exists(select 1 from public.user_roles where user_id=auth.uid() and role in ('admin','editor'))
$$;
create or replace function private.can_manage_orders() returns boolean language sql stable security definer set search_path='' as $$
 select private.has_admin_assurance() and exists(select 1 from public.user_roles where user_id=auth.uid() and role in ('admin','order_manager'))
$$;
commit;
