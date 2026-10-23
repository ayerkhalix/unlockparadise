# Client Supabase migration

Source: `iitblbdqztuxdzpaetie`. Client destination: `namkxlsdjnopixhzrvyl`.
Authorized by the owner on 2026-10-23. The source is retained for rollback.

## Current state

**Migration completed on 2026-10-23.** The local website on port 3000 now uses the
client project. All 23,559 media objects (14,911,980,132 bytes) are uploaded and
verified. The original project, original files and rollback configuration remain
intact. Current account passwords and UUIDs are preserved; users sign in again.

- Native PostgreSQL 17.11 backups of both projects are saved privately under
  `artifacts/client-migration/database/2026-10-23T06-52-56-785Z/`.
- A separate API safety copy contains 41 public tables (39,253 records), 13 Auth
  account records and four Storage objects (12,042 bytes). Its 47 files passed
  SHA-256 checks. It is supplementary; it does not replace the native DB backup.
- Before destination-only changes, all 46 compared tables matched exactly by
  row counts and SHA-256 digests, including password hashes, identities and MFA.
- Source application schema: 43 tables, 29 migrations, 385 Places, 9 itineraries,
  29 days, 10 stops, 5 products, 13 accounts and 3 verified TOTP factors.
- Source database restore did not replace managed Auth/Storage schemas, keys or
  managed Auth migration history. Storage bytes are copied through its API.
- All 23,559 database media entries have local verified source bytes, including
  the 23,555 legacy files and four newer uploads: **14,911,980,132 bytes**.
  Completion evidence is in `artifacts/client-migration/media/progress.json`.
- 143 primary images and 850 variants linked to protected Places were moved to
  private classification on the client project before upload. Source unchanged.
- Private variant signing now checks the parent image's visibility. Archive
  originals remain staff-only. Four buckets and the retention cron are restored.
- The client project's global upload cap is 50 MB. The archive bucket uses that
  cap rather than the source's 100 MiB setting; the largest file is 38,352,121
  bytes, so every existing file fits. No plan or billing setting was changed.
- Existing Explorer, Explorer+ and MFA admin passwords/UUIDs work. Authenticator
  verification, protected names/images/variants, archive restrictions, and admin
  analytics access passed against the client project.
- Registration confirmation links, allowed callback, profile creation and free
  entitlements passed with a disposable synthetic account; it was removed after
  testing. No email was sent by that test.
- Local Auth Site URL is `http://127.0.0.1:3000`, with explicit confirmation
  callbacks for it and `http://localhost:3000`. New hosted origins must be added
  when deploying. Source email templates use built-in SMTP/default templates;
  custom production SMTP remains an independent deployment configuration.
- Compromised-password protection is enabled on the paid client project.
  Its Security Advisor reports 0 errors, 0 warnings, and 2 intentional deny-all
  private-table suggestions. See saved screenshots in the private artifact folder.
- Final comparison: 44 current-data/identity table checks, all 56 foreign-key
  relationships, all original audit records and migration history preserved;
  zero content or Storage inventory mismatches. The original 29 migrations are
  retained, with three migration-specific security/configuration additions.
- 24 desktop/mobile page checks passed on the main site, including the client
  review admin. Production build, TypeScript, touched-file lint, eight focused
  authorization/tooling tests and release secret checks passed.
- Actual public and authenticated `/api/media/UUID/?variant=medium_large`
  requests redirect to the client Storage project and return matching bytes.
  Anonymous protected requests return 404. Local private-media fallback is now
  disabled. The Xendit operator's read-only status command works on the client
  database; payment keys, provider selection and approved test-user IDs are
  unchanged. No real payment was made.
- The Supabase connector remains scoped to the original project. Client work was
  completed with the explicitly supplied database/API credentials; future tools
  must target the client ref rather than the old connector default.

## Transfer and verification commands

Migration credentials are in ignored `.env.migration.local`; the app still uses
`.env.local`. Neither credential file nor private artifacts belong in Git.

```powershell
node --env-file=.env.migration.local scripts/migration/project-backup.mjs
node scripts/migration/project-database.mjs backup
node scripts/migration/project-media.mjs --apply --concurrency=24
node scripts/migration/project-smoke.mjs
node scripts/migration/project-verify.mjs
```

The media copy is resumable. It validates local MIME, byte size, SHA-256 and safe
paths, uploads without overwrite, downloads each object independently, and only
then marks metadata ready. Progress checkpoints are written atomically. Differing
existing content stops the copy; no conflicting object is overwritten.

Restoration is intentionally limited to an empty pinned destination. Never rerun
`project-restore.mjs --apply` on the populated client project. The original legacy
content importer/reconciliation manifest is not the current database baseline.

## Completed cutover

1. Finish every image and verify Storage object keys, sizes, checksums and media
   readiness, including all variants and originals.
2. Check source changes since the backup and carry over any new writes while
   preserving destination-only privacy/status changes.
3. Check desktop/mobile pages and authenticated flows on the client preview;
   verify actual `/api/media/UUID/` redirects and private/public access.
4. Save a private rollback copy of the current app environment; replace only its
   Supabase URL, publishable/secret keys, DB URL and migration project pin. Keep
   Xendit in sandbox mode and existing approved test-user UUIDs.
5. Restart the main local server and repeat smoke checks. Users sign in again
   because project JWT keys and cookie names differ.

All five steps passed. Private rollback configuration is under
`artifacts/client-migration/cutover/2026-10-23T07-55-22-342Z/`. To roll the local app
back, stop its server, restore that directory's `source-env.local` as `.env.local`,
then restart it. Keep a copy of the client environment and reconcile any writes
made after cutover before deliberately returning to the source database.

The owner's previously requested client-review MFA exemption was inspected and
retargeted to the client project's verified issuer. It remains restricted to its
existing server-approved synthetic account, private allowlist and live admin
role; no new exemptions were added. Ordinary administrators still require MFA.
Existing MFA-enabled admin accounts migrate normally. Small application assets (logos, fonts and
bundled storefront artwork) remain in the application repository and deploy with
the application; the destination library and all uploaded media move to Storage.

No source data, local original, WordPress site, domain, deployment, or real payment
configuration was deleted or changed. Small bundled app assets remain in the
repository; bulk destination/attachment files and uploaded images use Storage.
