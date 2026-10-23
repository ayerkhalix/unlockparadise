# Phase 2 executed test results

19 October 2026, Asia/Manila. Local Next.js application backed by isolated Supabase staging project `iitblbdqztuxdzpaetie`. Production WordPress and customer records were not modified. No production deployment or live payments occurred.

## Results

| Check                                 | Status                       | Executed evidence                                                                                                                                                                       |
| ------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                            | PASSED                       | `npm run typecheck`; Next route generation and tsc                                                                                                                                      |
| ESLint                                | PASSED                       | `npm run lint`; zero errors/warnings                                                                                                                                                    |
| Formatting and whitespace             | PASSED                       | Prettier on changed source/docs; `git diff --check`                                                                                                                                     |
| Production build                      | PASSED                       | `npm run build`; Next 16.4.1 production compilation, type checking and page generation                                                                                                  |
| Embedded unit/database/security tests | PASSED                       | `npm run test:backend`: 46/46, including the real WordPress import and new planning/RLS tests                                                                                           |
| Hosted staging acceptance             | PASSED                       | `npm run test:staging:authenticated`: nine groups; real Auth, TOTP MFA, membership/expiry, ownership, Storage, moderation and logout                                                    |
| Desktop/mobile browser suite          | PASSED AFTER TARGETED FIXES  | 43 applicable tests passed; three intentional skips. The four accessibility/logout confirmations passed against the final production build                                              |
| Route/responsive/axe matrix           | PASSED                       | 392 checks, 56 route/UI-state captures, seven widths, 112 axe scans; zero final findings                                                                                                |
| Contact geometry                      | PASSED                       | Horizontal center offset 0px at every audited width                                                                                                                                     |
| Before/after visual comparison        | PASSED REVIEW                | 14 pixelmatch comparisons plus screenshot inspection; expected feature/layout differences are retained                                                                                  |
| Release secret/source boundary        | PASSED                       | `npm run check:release`; no forbidden tracked paths, suspected secrets or browser secret modules; untracked implementation source is also scanned                                       |
| Production dependency audit           | PASSED                       | `npm audit --omit=dev --json`: zero vulnerabilities                                                                                                                                     |
| Full dependency audit                 | OUTSTANDING                  | Five high-severity transitive development-tool findings through eslint-config-next / fast-glob / micromatch / braces; no compatible patch was offered by npm. No forced major downgrade |
| DESIGN.md structure                   | PASSED                       | Official designmd lint: zero errors or warnings                                                                                                                                         |
| Premium static auditor                | TOOL FINDINGS REVIEWED       | Strict exit 1: 13 verified delegated/library action false positives, documented in UX_AUDIT.md                                                                                          |
| Impeccable detector                   | REVIEWED                     | 90 initial findings: three side-accent warnings fixed, 87 color/radius advisories retained as maintenance inventory                                                                     |
| Supabase security advisor             | WARNING                      | No database/RLS finding; existing Auth leaked-password protection is disabled                                                                                                           |
| Production email delivery             | BLOCKED                      | Environment/provider allowlisting is not enabled; no customer email sent                                                                                                                |
| Payment-provider acceptance           | BLOCKED                      | Separate provider configuration and authorization required; no live checkout enabled                                                                                                    |
| Real merch orders                     | BLOCKED BY SOURCE CAPABILITY | Original merch repository has no order/payment backend; preview and persistent local bag are implemented honestly                                                                       |

## Browser execution and corrections

The production suite covers original area maps, filtering/sorting/reset, public and premium gates, private-file denial, navigation forms, mobile drawer, all six home category links/history, Bucketlist persistence and failure feedback, trip CRUD, actual map markers and accessible map list, pointer and arrow reorder, cross-day notes/reload, owner 404 and stale-version 409, write failure/retry, boat/hike values, sanitized descriptions, recommendations/admin saving, gallery keyboard behavior, merch variants/bag/reload, and account/logout.

The broad production run passed 39 tests, found two hover-contrast failures in the floating control, skipped two dependent logout tests and intentionally skipped three environment/viewport-specific tests. The contrast failure was reproduced from computed colors: the retained theme's hover ink overrode the floating control. Scoped shared hover rules fix theme overrides, and the persistent floating control no longer fades its text through low-contrast intermediate opacity on mount. The final focused confirmation reruns the two accessibility and two logout checks against the rebuilt production server. Result: all four passed (desktop/mobile accessibility and logout). Together with the 39 passed checks in the broad run, all 43 applicable browser checks pass; no browser failure remains open.

Intended skips: the unconfigured-backend test in each project (the real backend is configured), and the desktop-only omission of the mobile drawer test. Earlier debugging failures (selector scope, duplicate synthetic names, confirmation focus and dragging from nested controls) were corrected and their affected journeys passed. A concurrent test-run artifact collision was a harness error; final test commands run sequentially.

Repeated fixture setup obtains real Supabase Auth/SSR sessions directly, including real MFA, to avoid consuming the app login throttle on reruns. The separate hosted acceptance suite verifies the actual login endpoint. Application throttling remains enabled. Credentials and traces remain in ignored private artifacts.

## Routes and states

See [UX_AUDIT.md](UX_AUDIT.md) for the route inventory and issue/fix table. Representative templates and significant admin tabs were audited; this is not a claim that every destination record or legacy WordPress export alias was manually reviewed. Chrome desktop and mobile emulation were used at 375, 390, 430, 768, 1024, 1440 and 1920px. Physical devices, Safari/Firefox, screen readers and a full physical-browser zoom matrix were NOT TESTED.

## Database and data integrity

Three additive Phase 2 migrations are applied to staging and their local UTC versions match staging history. All new tables use grants/RLS and guarded RPCs. Existing Bucketlist/Visited persistence remains in member_places. Only synthetic identities/Places/trips were used for write acceptance. Source-backed boat metadata marks 37 sole-Boat destinations and copies 33 explicit access-point names; no road, boat or hike duration was inferred from the legacy metric.

The remaining Auth advisor can be addressed through [Supabase password protection settings](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). It is an account configuration finding, not a new RLS defect.

## Readiness

The implemented Phase 2 scope is ready for staging review. Final production browser confirmation passed. Merch remains a catalog/local bag foundation as required by the source repository's capability. Real commerce, mail/provider acceptance, Auth password-protection configuration and development-tool dependency advisories remain release follow-ups. Production publication requires a separate decision.

Final cleanup removed two leftover synthetic trips and two synthetic Places from interrupted test runs; strict fixture ownership/title and slug guards were applied. The four synthetic test identities remain available for repeat acceptance. The owned preview servers were stopped after verification.

## Account, planner and merch follow-up — 19 October 2026

The user-reported desktop account defect was reproduced in the signed-in browser: profile styles were absent, the desktop flex child collapsed, and the theme removed header clearance. Scoped profile styling now supplies the full page width, responsive destination grid, identity, stats and settings. Account cards use a single real cover/gallery fallback; the profile-photo editor uses the shared modal. Header initials and floating count names were corrected after accessibility checks.

The planner now exposes its destination finder inline, with name search, stable area/category filters, six initial results and Show more, duplicate indicators, filtered map selection and explicit links to the main discovery map. Existing save/version/owner behavior is retained. Merch now uses the shipped Open Sans/Outfit typography, shared controls and a floating shopping cart with the real local item count. The supplied hero's black margins are cropped through responsive CSS.

Validation: production build and ESLint pass; 46/46 backend tests pass; release-secret checks and git diff whitespace checks pass. Ten focused browser cases pass across Chrome desktop 1440px and phone emulation 390px: account geometry/settings/photo-dialog focus, guest planning intent, real persisted planner search/filter/map/reorder/move/notes, injected failure/retry, and cart variants/count/navigation/persistence. Six affected-page axe scans passed, with zero reported violations. The final cart/hero cases were rerun after responsive framing changes (2/2 pass). Earlier failures identified real theme-cascade/visibility/accessible-name defects and outdated dialog/search locators, which were corrected before successful reruns.

Screenshots are in artifacts/phase2/account-refined-_, merch-refined-_ and planner-finder-*. Synthetic destinations/trips created by these tests were cleaned by their teardown. The user's Explorer+ browser session remains signed in. The requested development server remains running at http://127.0.0.1:3000; no production deployment was performed.

## Phase 2.1 unified planner — 19 October 2026

The canonical `/itineraries/` workspace now opens the most recently updated owned trip, with trip selection, new-trip creation and day tabs in place. First-time users create their first trip inline. Existing detail/create URLs redirect into this workspace, preserving selected days. The planner is directly accessible from desktop and mobile navigation. Unsaved notes require a discard decision before switching trips or days. Cross-site additions update the open planner and its version immediately.

Validation passed: TypeScript, ESLint, production build, release-secret/source checks and 46/46 backend tests. Twelve focused Chrome desktop/phone cases passed, including first-trip creation, trip switching and browser history, legacy links, notes guards, creation/cancellation, rename/delete, destination discovery, reorder/move/persistence, ownership/conflict responses, failure/retry and accessibility. Two additional desktop/phone cases verified Bucketlist additions update the open planner and permit the next save without a version conflict. Responsive checks include 390, 922, 1024, 1440 and 1920px; affected-page axe scans reported zero violations.

Interrupted-run cleanup removed three synthetic trips and two synthetic Places using exact identity, ownership and title/version guards. The cleanup receipt is `artifacts/phase21/cleanup.json`; other itineraries were unchanged and the saved Palawan 2026 trip was preserved. Screenshots are in `artifacts/phase21/`. The development server is available at http://127.0.0.1:3000. No production deployment or schema change was needed for this follow-up.

The resumed in-app browser exposed an ICU whitespace difference in date ranges that Chrome had not reproduced. Range whitespace is now normalized before rendering; a dedicated cross-ICU regression test passes. The rebuilt production bundle passes, and a fresh signed-in in-app browser tab reports no console errors or warnings. Explorer+ sign-in was completed at the user's request. The clean planner screenshot is `artifacts/phase21/workspace-live-desktop.png`.
