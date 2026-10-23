# Unlock Paradise staging

The client demo uses the Vercel project `unlockparadise-staging` and the client
Supabase project `namkxlsdjnopixhzrvyl`. The existing WordPress site is separate.

## Release configuration

- Framework: Next.js; install with the pinned npm 11.6.2 clean install in
  `vercel.json`, build with `npm run build`. The package manager matches the
  verified lockfile generator across Windows and Linux.
- Set `APP_URL` to the exact HTTPS hostname assigned to this staging project.
- Keep `UPD_ENVIRONMENT=staging` and `UPD_DATA_MODE=supabase`.
- Configure the Supabase URL and publishable key for both build and runtime.
  The Supabase secret key and recovery secret are server-only Vercel Secrets.
- Keep `LEGACY_PRIVATE_MEDIA_MODE=unavailable`. Destination images are served
  from verified client Storage; bundled fonts, branding and merchandise artwork
  are deployed with the app.
- Keep Xendit in test mode, with only the approved demo user UUIDs in
  `XENDIT_TEST_USER_IDS`. Live payment keys are rejected by the application.
- Email registration remains limited to the owner's explicitly approved inboxes.
  Demo identities are preconfirmed without sending email.
- Add the staging `/auth/confirm/` URL to the Supabase Auth redirect allowlist.
  Keep the local callbacks for local development.
- Xendit's test webhook endpoint is `/api/payments/xendit/`. Successful HTTPS
  checkout sessions return to this site's checkout and reconcile with Xendit.

## Demo access

Demo credentials are provided privately to the owner and are never committed.
The demo administrator uses the existing staging-only private MFA exception,
which also requires a server-managed claim and an active admin role. Other staff
accounts keep their MFA requirements. Explorer accounts have free access;
Explorer+ accounts have explicit demo entitlements.

## Files excluded from releases

`.env*`, private credentials, migration backups, the original image library,
test artifacts and local private destination fixtures are excluded by Git and/or
`.vercelignore`. Never commit a Vercel environment pull or a database export.

See `CLIENT_SUPABASE_MIGRATION.md` for migration verification and rollback notes.
