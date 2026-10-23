# Unlock Paradise

Next.js App Router recreation of Unlock Paradise with its original public presentation preserved and a Supabase backend/admin implementation. The existing WordPress site remains untouched.

Read [BACKEND_PROGRESS.md](BACKEND_PROGRESS.md) for executed checks and remaining gates, [the audit](docs/backend/BACKEND_AUDIT.md) for verified source behavior, and [deployment instructions](docs/backend/DEPLOYMENT.md) for isolated staging setup. The confirmed development database is imported and public integration is verified. Real staging Auth, MFA, RLS, Storage and authenticated browser acceptance now pass. Email delivery and payment-provider acceptance remain external configuration gates. See [Phase 2 results](PHASE_2_TEST_RESULTS.md).

## Local development

Xendit membership test checkout is now connected locally; see [setup, verified behavior and public-webhook limitation](XENDIT_INTEGRATION.md). Merchandise purchasing remains closed pending confirmed stock and shipping rules.

Node 24.11.1 was used for validation. Install dependencies with `npm ci`, configure `.env.local` from `.env.example`, then run `npm run dev` and open `http://127.0.0.1:3000`.

The current development configuration queries real Supabase destination metadata. Set `UPD_DATA_MODE=supabase` for integration or explicitly select `fixtures` for offline development only. Production refuses fixture mode or missing backend configuration. With Supabase configured, destinations and user features use its database/Auth/Storage and RLS. Without credentials, the existing ignored `src/data/destinations.private.json` supports the local visual preview; account/API mutations return configuration errors. A fresh checkout does not include private exports or snapshot data. Production must use the configured backend.

Local layout previews remain available through `npm run dev:explorer` and `npm run dev:explorer-plus` (use port 3002 for the second). These are development-only, never simulated authentication, and are disabled when Supabase is configured.

## Migration and verification

```powershell
npm run migration:audit
npm run migration:prepare -- --write
npm run typecheck
npm run lint
npm run test:backend
python scripts/migration/test_wordpress.py
npm test
npm run build
```

The new migration scripts read SQL/XML/ACF/media without modifying references. They reconcile the 383 production Places, exclude confirmed test ID 5693, preserve `vip_content` and `premium_content` independently, and prepare attachment/variant imports. Content/media commands default to dry-run; application requires a pinned isolated staging project. Account migration and customer mail require separate approval.

`npm run test:backend` uses embedded PostgreSQL and the actual generated private content manifest. Browser tests cover desktop/mobile presentation and direct access controls. `npm run test:backend-visual` compares against this session's ignored local baseline; `npm run test:visual` uses the existing read-only recorder. Neither proves hosted Auth/Storage or payment-provider acceptance. See [the API contracts](docs/backend/API_CONTRACTS.md), [security model](docs/backend/RLS_SECURITY.md) and [cutover plan](docs/backend/CUTOVER_PLAN.md).

On Windows, Playwright uses installed Chrome. Source SQL, identity manifests, browser captures, secrets and private media are ignored and excluded from deployment tracing. Never include `reference/` or `artifacts/` in a deployment package.

The historical [PHASE1-REPORT.md](PHASE1-REPORT.md) documents the original frontend recreation. Its pending-backend notes are superseded by the current progress tracker.

Full legacy media upload is deferred. Public legacy media uses the configured read-only origin; private staging images remain authorized and use local development copies or an unavailable placeholder. See [media readiness](docs/backend/MEDIA_MIGRATION_REPORT.md). To continue synthetic acceptance after adding the server-only development key locally, run `npm run staging:fixtures -- --apply`, then `npm run test:staging:authenticated` with the app running. Never commit the generated test credentials.

## Phase 2

[Progress](PHASE_2_PROGRESS.md) · [UX audit](UX_AUDIT.md) · [Design](DESIGN.md) · [Shared system](DESIGN_SYSTEM.md) · [UX contract](UX-CONTRACT.md) · [Itinerary architecture](ITINERARY_ARCHITECTURE.md) · [Bucketlist](BUCKETLIST_UX.md) · [Travel metadata](TRANSPORTATION_DATA_MODEL.md) · [Recommendations](RECOMMENDATIONS.md) · [Merch](MERCH_INTEGRATION.md) · [Executed tests](PHASE_2_TEST_RESULTS.md).

Run `node --env-file=.env.local node_modules/@playwright/test/cli.js test` against the configured staging project for browser acceptance. `tests/phase2-audit.mjs` produces the seven-width route and axe audit. Synthetic credentials, screenshots and traces stay under ignored `artifacts/`/`test-results/`; they are not deployment inputs. Phase 2 is local/staging work and has not been deployed to production.

## Phase 3 Admin Studio

[Architecture](ADMIN_ARCHITECTURE.md) · [Progress](ADMIN_PROGRESS.md) · [Design](ADMIN_DESIGN_SYSTEM.md) · [Permissions](ADMIN_PERMISSIONS.md) · [Places](PLACES_MANAGEMENT.md) · [Commerce](MERCH_COMMERCE.md) · [Analytics](ANALYTICS_EVENTS.md) · [Security audit](ADMIN_SECURITY_AUDIT.md) · [Executed tests](ADMIN_TEST_RESULTS.md).

The eight-module studio extends `/admin/`. Staging requires a real MFA-verified Owner, Content editor or Order manager session. Public merchandise checkout remains disabled. Run `node --env-file=.env.local node_modules/@playwright/test/cli.js test tests/admin-studio.spec.ts` for synthetic staging acceptance, including the five-width accessibility matrix. Credentials and artifacts remain ignored.
