# Staging test results

Date: 2026-10-18, Asia/Manila. Project: `iitblbdqztuxdzpaetie`.

| Check | Result | Evidence / limit |
|---|---|---|
| Remote migrations | PASSED | Nine migrations applied and queried through connector |
| Destination/content reconciliation | PASSED | Counts and complete content digests match for 12 tables; 383 Places; excluded 5693 absent |
| Domain RLS coverage | PASSED | 27 enabled, zero unprotected domain tables |
| Hosted security advisor | PASSED | Zero findings after explicit ACL and private RPC implementation changes |
| Live anonymous REST/Storage/application checks | PASSED | Eight checks via `npm run test:staging`; includes real denied tiny-image upload, private media denial, public teaser visibility and app query/image resolution |
| Public browser regression | PASSED | Eight desktop and nine mobile checks against Next.js using real Supabase content; three inapplicable/offline-only cases skipped |
| Embedded PostgreSQL/backend tests | PASSED | 37 tests; migration replay, access matrix, ownership, MFA boundaries, payments and legacy media handling. These are local, not real Auth sessions |
| WordPress parser tests | PASSED | Two source parsing tests |
| TypeScript / production build / lint / release scan | PASSED | Executed locally with configured Supabase project; no tracked private exports, secrets or browser secret modules |
| Production-server HTTP smoke | PASSED | Six real read-only checks; public pages/API healthy and protected image returns 404 |
| Synthetic account setup | BLOCKED | `SUPABASE_SECRET_KEY` is empty; command attempted and refused before writes |
| Real sign-in/out, refresh and recovery sessions | BLOCKED | No synthetic identities created yet; SMTP/test delivery additionally needed for recovery |
| Real Explorer/Explorer+/expired/admin matrix | BLOCKED | Requires synthetic Auth sessions; embedded matrix is not substituted |
| Real member persistence, reviews and admin CRUD | BLOCKED | Same missing server credential/synthetic setup |
| Authorized small Storage uploads/downloads | BLOCKED | Anonymous denial tested; positive authenticated Storage acceptance still pending |
| Authenticated browser journeys and MFA | BLOCKED | Prepared runner exits BLOCKED without credentials; no mocked sessions counted |
| PayMongo provider checkout/webhooks | BLOCKED | No sandbox keys or reachable configured webhook; local signature/transaction tests passed |
| Email delivery | BLOCKED | Email gates disabled and no approved SMTP/transactional delivery configured |
| Full media upload | NOT TESTED | Explicitly deferred by user; zero legacy objects uploaded |
| Hostinger deployment acceptance | BLOCKED | No plan/runtime/access supplied |

Strict saved-baseline visual comparisons were executed and exposed differences. Homepage and sampled guest detail measurements reached 0% on desktop and approximately 0% on mobile after preserving original image sizes, category labels/icons and public teaser relationships. Login differs because the form is functional. Strict archive snapshot differences are 7.8186% desktop and 27.8356% mobile (full-page shifts amplify the small height change). Archive screenshots remain different because the seven customer-linked legacy reviews were not imported; the missing rating badge changes one card and page height by about 41–42 pixels. This is a documented data-parity gap, not a passed visual gate. The old About baseline has unloaded below-fold images. Loaded captures compared with the original WordPress recorder measured 0.1049% desktop and 0.3137% mobile. See ignored `artifacts/backend-visual-report.json` and the original-recorder comparison output for measurements. No universal pixel-perfect claim is made.

Commands and machine-readable evidence:

```powershell
npm run test:staging
node --env-file=.env.local node_modules/@playwright/test/cli.js test
npm run test:backend
python scripts/migration/test_wordpress.py
npm run typecheck
npm run lint
npm run build
npm run test:backend-visual
```

Ignored artifacts: `staging-content-reconciliation.json`, `staging-public-results.json`, `staging-acceptance.json`, `staging-migrations.json`, `connector-import-progress.json`, `storage-estimate.json`. A report's BLOCKED/NOT TESTED status is not a pass. Auth user count and Storage object count remain zero at this checkpoint.
