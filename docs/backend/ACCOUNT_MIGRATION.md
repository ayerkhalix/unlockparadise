# Account continuity

Status: tooling implemented; real account migration and hosted Auth demonstration **BLOCKED** pending isolated credentials and explicit identity approval. No account or customer email was created or sent.

21 WordPress accounts were counted without printing names, emails or hashes. Password hashes are excluded from every generated identity manifest. Do not put WordPress hashes in Supabase password fields. Supabase documents its password storage and Auth migration interfaces; WordPress compatibility was not established from the provided material. A verified email/password-recovery transition is safer than inventing a hash bridge.

Recommended sequence:

1. Prepare a private identity/ownership plan: `python scripts/migration/prepare-accounts.py --write`. Inspect it privately. It contains identity data and must remain ignored and outside deployment packages.
2. Demonstrate mapping with `npm run migration:accounts -- --synthetic`. This is a dry-run. With pinned staging credentials, `--synthetic --apply` uses `auth.admin.createUser` for an `example.test` identity, confirms only that synthetic account and sends no email. Its random password is never printed.
3. Confirm the real identity strategy and customer communication before setting `ACCOUNT_MIGRATION_APPROVED=true`. The importer refuses email collisions instead of linking unrelated registrations. It preserves `profiles.legacy_id`, is repeatable for mapped users and never imports admin privileges.
4. The real-account import foundation creates unconfirmed accounts with unknown random passwords and sends no mail. Validate the approved invitation/recovery process with synthetic accounts first. Do not assume those accounts are customer-ready merely because they exist.
5. Use approved Supabase email templates and approved SMTP/test inboxes. Signup link: `{{ .SiteURL }}/auth/confirm/?token_hash={{ .TokenHash }}&type=signup`. Recovery link: `{{ .SiteURL }}/auth/confirm/?token_hash={{ .TokenHash }}&type=recovery`.
6. After verified ownership and membership reconciliation approval, `node --env-file-if-exists=.env.local scripts/migration/member-data.mjs --apply` imports mapped lists/reviews/likes and reviewed eligible legacy grants. Unmapped owners/Places are deferred with a nonzero exit, not discarded. Existing recurring-provider records stay deferred until reconciled.

The callback verifies token type at Supabase, then issues a ten-minute HMAC recovery grant bound to the verified user. Password changes require that grant or the current password. An arbitrary `next` URL or `type=recovery` query alone does not authorize a password change.

Admin onboarding: create and verify an approved operator account in staging; bootstrap its `user_roles` row through a trusted database session. Do not expose a public bootstrap endpoint. Enroll TOTP at `/admin/mfa/`; every admin operation also requires AAL2 in PostgreSQL. Test a second administrator before changing roles. The final administrator cannot be removed.

References: [Supabase password security](https://supabase.com/docs/guides/auth/password-security), [Auth users/admin APIs](https://supabase.com/docs/guides/auth/users), [SSR email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [SSR session guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide).
