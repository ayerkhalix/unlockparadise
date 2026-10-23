# Admin Studio architecture

Phase 3 extends the existing `/admin/` application. It does not introduce a second admin or change the public brand. Eight URL-backed modules share `AdminConsole`, `admin/shared.tsx`, native form controls, `ValidatedForm`, `Modal`, `useDecision` and the existing notice system. Section, committed filters, sort and page live in query parameters. Lists use 25-record server pages; searches cancel stale requests. Editors use document scrolling and preserve input after failed saves.

`/api/admin/[...resource]` retains content, membership, moderation and media handlers. `src/lib/admin-studio.ts` handles catalog, orders, sales, analytics and connection status behind independent server authorization. Database RPCs enforce MFA/permissions again. Security-definer implementations remain in `private`; exposed wrappers are invokers with explicit grants.

The catalog uses `merch_products` and `merch_variants`. The four source products are imported once, preserving their stable IDs and asset paths for existing local bags. Runtime storefront queries use the database. Unknown inventory is nullable, visibly uncounted, and cannot enter future checkout. No sample ratings or stock counts were fabricated.

`merch_orders`, immutable item snapshots and `merch_payment_events` form a sandbox order foundation. Trusted preparation calculates totals from current variant centavos. Trusted confirmation validates amount/reference, locks consistently and records provider-event identity. Admin fulfillment never changes financial state. Public merch checkout remains disabled; provider activation and reservation/fulfillment policies are production gates.

Interest analytics uses a small opt-in event store and bounded aggregation RPC. Raw events contain no account identity or arbitrary payload. A daily Supabase Cron job removes events older than 90 days and prunes only its own run history after seven days. See the [official Cron scheduling reference](https://supabase.com/docs/guides/cron/quickstart).

Staging project: `iitblbdqztuxdzpaetie`. Seven additive Phase 3 migrations cover studio/commerce/analytics, original catalog import, operational summaries/retention, inventory-version locking, anonymous viewer-RPC compatibility, period-ranked Place interest, and product-photo lifetime protection. Local filenames match the applied UTC history. Existing WordPress records, member collections and trip history are retained.
