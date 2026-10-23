# Phase 3 executed verification

19–20 October 2026, Asia/Manila. Local application connected to isolated staging `iitblbdqztuxdzpaetie`. Tests use synthetic identities and uniquely named records. No production deployment, live payments, WordPress writes or customer migration occurred.

## Executed checks

| Check                                     | Actual result                                                                                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:backend`                    | 67 passed, 0 failed, 0 skipped; applies all seven Phase 3 migrations plus existing migrations to embedded PostgreSQL                                             |
| Admin Studio browser acceptance           | 22 passed across the full run (18), added lifecycle/duplication cases (2) and uploaded-photo cases (2); 2 intentionally skipped duplicate mobile width matrices. |
| Existing public/member/browser regression | 49 passed, 3 expected skips: two offline-only cases in configured staging and the mobile-only drawer case on desktop                                             |
| `npm run test:staging:authenticated`      | 9 passed, 0 failed; real Auth/MFA, RLS, Storage uploads, moderation, entitlement revocation and sign-out                                                         |
| `npm run typecheck` / `npm run lint`      | Passed with no errors or lint warnings                                                                                                                           |
| `npm run build`                           | Optimized Next.js 16.4.1 production build passed                                                                                                                 |
| Built-app smoke checks                    | 12 routes/module checks passed, anonymous admin API returned 401, 0 browser page errors                                                                          |
| `npm run check:release`                   | Passed: no forbidden tracked files, suspected source secrets or browser secret modules                                                                           |
| Formatting / `git diff --check`           | Passed for the touched admin/test sources; Git reports only the existing Windows line-ending notices                                                             |
| Official `designmd lint DESIGN.md`        | 0 errors, 0 warnings                                                                                                                                             |

Browser commands were run in separate bounded groups: `tests/admin-studio.spec.ts`; `tests/site.spec.ts tests/backend.spec.ts tests/phase2.spec.ts`; and focused added lifecycle/media cases. All use installed Chrome at 1440px and touch-emulated 390px. The optional staging acceptance runner also uses real browser sign-in. Test contexts do not replace the user's preview session; logout is scoped to the test session.

## Runtime coverage

Forty module/width combinations (eight modules × 390/768/1024/1440/1920) have no horizontal overflow and zero axe findings. Expanded Place/product editors were checked at all five widths, with four additional clean axe scans at 390/1440. Review details also passed axe in both projects. The editor checks exercise native photo selection, Enter in photo search, and reduced-motion controls. Native select/date popup geometry remains platform-owned.

Verified behavior includes independent API/MFA/role guards; anonymous/Explorer/Explorer+ denial; Editor and Order manager boundaries; origin/forged financial-field rejection; URL search/filter/history; product create/publish, exact prices, storefront propagation, stale edits, saved-bag price/availability reconciliation and archive; Place creation, taxonomy selection, draft preview, guest draft denial, publishing, travel/SEO save, dirty cancellation, archive and exact-slug deletion with cancellation; product duplication as a zero-stock draft; fulfillment/notes/CSV; confirmed-payment immutability; role changes and manual entitlement grant/revoke; review publish/hide/history; consent, entity validation, view deduplication and failure/retry.

Backend checks additionally cover actual transactional/RLS boundaries, cross-user collections/plans, HTML/upload/body security, malformed product data, variant reassignment, unknown inventory, trusted integer order totals, idempotent payment/refund reconciliation, stock/version guards, ranked date/area/category interest, reference-safe Place deletion and audit redaction. Product media regression covers revocation/deletion rejection, detachment before cleanup and rejection of deletion-prepared media.

Verified corrections include SQL variable ambiguity, public viewer-RPC compatibility, exact filter labels, inherited admin header clearance, Supabase offset/microsecond timestamps, current member-details reloading after access changes, and product-gallery media reference protection. A draft-visibility test was corrected to use an anonymous request: a verified Owner is intentionally allowed to read drafts. The media fixture cleanup was corrected to avoid deleting an already removed file. No unresolved failed assertion is treated as a pass.

## Static audit review

The premium strict auditor exits 1 with the same 13 reviewed false positives in public delegated/library controls; no new admin violation. Real action handlers and the public/member browser tests establish their behavior. No no-op handlers were added to silence it.

The Impeccable detector reports three Open Sans warnings and 32 color/radius advisories. The brief explicitly preserves this brand body font. Literal advisories include inherited admin/MFA rules and the documented studio palette/status shapes. Runtime CSS is canonical; this is not represented as a clean detector exit. Engineering audit assessment: accessibility 3/4, performance 3/4, responsive behavior 4/4, theming 3/4, integrity 4/4 (17/20). This is a bounded review, not certification or a performance benchmark.

The hosted security advisor reports only the existing disabled leaked-password-protection setting; all 37 application tables have RLS. Performance advice retains one earlier composite itinerary FK index notice, the polymorphic `taxonomy_media` table's lack of a primary key, 17 overlapping read/write policy notices, and 15 unused-index notices in this small staging workload (including the new gallery-reference GIN index). No policy consolidation or speculative index removal was performed. See ADMIN_SECURITY_AUDIT.md for context and remediation references.

## Evidence and limits

Ignored artifacts: `artifacts/phase3/accessibility.json`, module screenshots, `impeccable-detect.json`, `premium-audit.json`, `production-smoke.json`, lifecycle/media browser output; `artifacts/staging-acceptance.json`; `artifacts/release-check.json`. Final cleanup is saved in `artifacts/phase3/final-cleanup.json`: 384 preserved Places, original product IDs 1–4 with 12 variants, zero orders/events/new Phase 3 Places/uploads, and the preserved Palawan 2026 trip with two stops. Two orphaned records from an earlier failed cleanup were removed by exact ID/slug through the real Owner MFA deletion RPC; the pre-existing staging record remains. Clean desktop/phone captures and their geometry/image checks are saved in `final-captures.json` and `admin-studio-final-*.png`.

Physical devices, screen readers, Safari and Firefox were not executed. Chrome device emulation is not physical-device acceptance. Production SMTP, dedicated merchandise webhook integration/provider end-to-end acceptance, shipping/tax/reservation policy and live checkout remain external gates. Public merchandise checkout stays disabled; these tests do not simulate a successful real purchase.
