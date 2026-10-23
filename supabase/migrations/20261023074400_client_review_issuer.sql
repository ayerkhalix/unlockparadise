begin;
-- Preserve the owner's explicitly requested client-review account behavior when
-- moving its existing data to the client project. No new exemptions are seeded.
-- The server-managed claim, private allowlist and live admin role are all still
-- required. Ordinary admin/editor/order-manager accounts continue to need AAL2.
create or replace function private.has_admin_assurance() returns boolean
language plpgsql stable security definer set search_path='' as $$
declare claims jsonb:=auth.jwt(); caller uuid;
begin
 if coalesce(claims->>'aal','')='aal2' then return true; end if;
 if coalesce(claims#>>'{app_metadata,staging_client_review}','')<>'true' then return false; end if;
 if claims->>'iss' is distinct from 'https://namkxlsdjnopixhzrvyl.supabase.co/auth/v1' then return false; end if;
 caller=auth.uid();
 if caller is null then return false; end if;
 return exists(select 1 from private.staging_admin_mfa_exemptions e
   join public.user_roles r on r.user_id=e.user_id and r.role='admin'
   where e.user_id=caller and e.enabled);
end $$;
revoke all on function private.has_admin_assurance() from public,anon,authenticated,service_role;
commit;
