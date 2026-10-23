# Production readiness

Status: **not accepted for production**. Database/public development integration is verified; authenticated and provider acceptance remain open.

- [x] Confirm intended development target with user and inspect pre-existing state.
- [x] Apply nine non-destructive schema/security migrations; keep all domain RLS enabled.
- [x] Import/reconcile 383 Places, taxonomies, flags, coordinates, ordering, attachment mappings and legacy paths.
- [x] Require real backend configuration in production; prevent silent fixture fallback in Supabase mode.
- [x] Verify hosted anonymous REST, application reads, protected media denial and denied Storage writes.
- [x] Preserve original media locally and provide bounded/resumable checksum-verified upload tooling without executing bulk upload.
- [x] Run hosted security advisor, local backend/parser checks and public browser checks.
- [ ] Configure the development server-only key and create only synthetic test identities.
- [ ] Pass real Auth, expiry/revocation, cross-user RLS, member persistence, admin MFA/CRUD and authenticated browser journeys.
- [ ] Verify a very small set of synthetic Storage uploads/downloads and cleanup.
- [ ] Configure approved test SMTP and transactional transport; prove confirmation/recovery/notification delivery.
- [ ] Configure PayMongo test keys, allowed test users and reachable sandbox webhook; prove provider events and replay handling.
- [ ] Resolve customer-linked legacy review/data parity and any remaining visual discrepancies without migrating customer accounts during this phase.
- [ ] Reconcile existing subscriptions/refund policy with actual provider records; never grant unpaid recurring access or duplicate charges.
- [ ] Validate actual Hostinger Node/runtime/resources, HTTPS callback URLs, scheduler, monitoring and backups.
- [ ] Select production Storage capacity and approve a full media upload separately. Current files total 14,911,968,090 bytes; the present plan does not authorize bulk upload.
- [ ] Obtain a fresh cutover export/delta, reviewed account mapping and explicit approval for customer migration/communications.
- [ ] Obtain explicit approval for production deployment, live payments and domain/DNS cutover.

Original WordPress, production accounts, production domain and live payments remain unchanged. Development fixture passwords, MFA secrets, private exports and credentials are ignored by Git and excluded from deployment tracing. See [integration report](SUPABASE_INTEGRATION_REPORT.md), [staging results](STAGING_TEST_RESULTS.md), [media report](MEDIA_MIGRATION_REPORT.md) and [cutover plan](CUTOVER_PLAN.md).
