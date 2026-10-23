# Backend implementation progress

Updated 2026-10-18 (Asia/Manila). This checkpoint supersedes earlier offline-only results. Original WordPress/reference files remain read-only.

## Current state

**The development application now reads real Supabase destination data.** Database/public integration is accepted; authenticated member/admin/provider acceptance remains **BLOCKED**. This is not a production readiness claim.

The user confirmed project `iitblbdqztuxdzpaetie` in `ap-south-1` as development before writes. Initial inspection found no application tables, migrations, Auth users, buckets or Storage objects. Nine migrations are now applied, all 27 domain tables have RLS, and the final hosted security advisor returned zero findings.

## Imported and reconciled

| Data | Actual |
|---|---:|
| Production Places / details | 383 / 383 |
| Areas / categories | 4 / 8 |
| Place-area / Place-category relationships | 380 / 379 |
| Cover/gallery relationships | 2,928 |
| Taxonomy images / legacy redirects | 8 / 11 |
| Attachment records | 3,431 |
| Variant/original file metadata | 20,124 |
| WordPress test Place 5693 | Excluded; zero rows |
| Auth identities / Storage objects | 0 / 0 |

The existing manifest supplied 179 transactional connector batches. Counts and normalized complete content digests match for all 12 imported tables. Publication dates, flags, coordinates, legacy IDs, slugs, text, paths, metadata and checksums are included; only generated creation/update timestamps are excluded. Invalid coordinates on source 3991 remain null with raw source values retained. The original SQL SHA-256 remains `b5bf61912f4364b791b588e623667d63946b26e85b96338dc8515c6af966729e`.

## Implemented and checked this phase

- Connected URL, publishable key and pinned project reference in ignored `.env.local`; no secret printed/committed. Its server-only key remains empty.
- Explicit fixture/Supabase modes. Supabase query errors never fall back to fixtures; production requires backend configuration.
- Corrected hosted default ACL differences; guarded implementations now reside in the unexposed private schema behind invoker RPC wrappers. Added foreign-key indexes and cached constant policy lookups without weakening authorization.
- Preserved source-classified public teasers in guest RLS. Private galleries remain restricted. Original featured labels/icons and WordPress image sizes are retained through a variant-aware media resolver.
- Legacy metadata is marked `legacy`, separately from cloud-verified `ready`. Public legacy images resolve through the configured read-only WordPress origin. Private images never redirect there: authorized local development may serve checksum-verified originals; deployed staging uses an authorized placeholder until Storage migration.
- Full media upload was explicitly deferred. Existing utility now supports bounded concurrency, offset/limit batches, progress, safe retries and remote checksum verification. More than five uploads require an explicit bulk flag; no bulk command was executed.
- Prepared a four-identity synthetic fixture command and real Auth/MFA/CRUD/Storage/browser runner. These refuse execution without the server-only key; no fake authenticated pass is recorded.

## Executed verification

- **PASSED:** nine hosted migrations; 27 RLS tables; zero unprotected domain tables; zero hosted security advisor findings.
- **PASSED:** all 12 hosted content digests/counts; database size approximately 34.4 MB; excluded test absent; Storage objects zero.
- **PASSED:** eight real anonymous REST/Storage/application checks, including denied tiny synthetic upload, protected media denial, public teaser references, privilege rejection and live app queries.
- **PASSED:** 17 public browser checks across desktop/mobile against the Supabase-connected application; three offline/inapplicable cases skipped.
- **PASSED:** 37 local backend/security tests, including full import replay, permissions, payment contracts, legacy media, configuration guards and RFC TOTP code generation. These do not prove real Auth/MFA sessions.
- **PASSED:** two WordPress parser tests, TypeScript, ESLint, production build, release secret/tracking scan and six production-server HTTP smoke checks.
- Visual comparisons executed: homepage and sampled guest detail approximately match saved baselines after fixes; original-recorder About differences are 0.1049% desktop and 0.3137% mobile. Strict archive baseline checks remain **FAILED** because deferred legacy review ratings change one card/page height by 41?42 pixels. Login changes reflect its functional form. No universal visual-parity claim is made.
- Full 23,555-file source inventory/checksums preserved. Total 14,911,968,090 bytes; 22,786 distinct SHA-256 objects represent 14,607,877,838 unique bytes. Storage upload remains deferred.

## Remaining gates

- **BLOCKED:** `SUPABASE_SECRET_KEY` is empty. Real synthetic Auth sessions, Explorer/Explorer+/expired/admin matrix, member writes, admin MFA/CRUD, positive small Storage uploads and authenticated browser acceptance have not run. User will configure this locally. Prepared commands: `npm run staging:fixtures -- --apply`, then `npm run test:staging:authenticated` with the local app running.
- **BLOCKED:** email verification/recovery delivery and membership notifications need approved SMTP/transactional transport and test inboxes. Application email gates remain false.
- **BLOCKED:** PayMongo external sandbox checks need test keys, a synthetic allowlist and reachable webhook. Local contract/signature tests passed; no provider checkout was called.
- **BLOCKED:** Hostinger plan/runtime/deployment validation and legacy subscription/refund continuity require external configuration/evidence.
- **DEFERRED:** full media upload, the 21 customer identities, seven customer-linked reviews and account-owned migration. No production account or customer communication was migrated/sent.
- Production deployment, live charges, customer migration/email and domain/DNS cutover require separate explicit authorization.

Detailed evidence: [integration](docs/backend/SUPABASE_INTEGRATION_REPORT.md), [staging results](docs/backend/STAGING_TEST_RESULTS.md), [migration](docs/backend/MIGRATION_REPORT.md), [media](docs/backend/MEDIA_MIGRATION_REPORT.md), [security](docs/backend/RLS_SECURITY.md), [production readiness](docs/backend/PRODUCTION_READINESS.md).
