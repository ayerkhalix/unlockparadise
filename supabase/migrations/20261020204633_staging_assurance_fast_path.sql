begin;
-- Ordinary AAL1/anonymous readers must not query a privileged allowlist per row.
-- This server-managed claim is only a fast negative signal. Authorization still
-- requires the verified issuer, live private allowlist and current admin role.
create or replace function private.has_admin_assurance() returns boolean
language plpgsql stable security definer set search_path='' as $$
declare claims jsonb:=auth.jwt(); caller uuid;
begin
 if coalesce(claims->>'aal','')='aal2' then return true; end if;
 if coalesce(claims#>>'{app_metadata,staging_client_review}','')<>'true' then return false; end if;
 if claims->>'iss' is distinct from 'https://iitblbdqztuxdzpaetie.supabase.co/auth/v1' then return false; end if;
 caller=auth.uid();
 if caller is null then return false; end if;
 return exists(select 1 from private.staging_admin_mfa_exemptions e
   join public.user_roles r on r.user_id=e.user_id and r.role='admin'
   where e.user_id=caller and e.enabled);
end $$;
commit;
