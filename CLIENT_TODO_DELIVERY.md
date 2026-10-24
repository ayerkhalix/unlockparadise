# Client todo delivery — 24 October 2026

All PDF implementation batches and scoped verification are complete and deployed to https://unlockparadise-staging.vercel.app. The client demo uses the existing guest, Explorer, Explorer+ and authorized admin access; no real payment or email is sent by these checks.

| Client walkthrough | Local result | Staging confirmation |
| --- | --- | --- |
| Guest / Explorer discovery | Featured names/photos; other premium names hidden; destination and feature hooks; safe Back and Membership return | Verified |
| Mobile navigation / consent | Partial-width left drawer, direct account links, category clearance, persisted cookie choice, keyboard and reduced motion | Verified |
| Discovery / profile | Simplified result, private sharing, compact profile, guarded name/photo/preferences saves, retained errors and confirmed reload | Verified |
| Destination directions | No Add to Portfolio; interaction labels; distinct destination/access-point Maps links and destination coordinates | Verified |
| Planner | Select day → Explore destinations → category/filter → add a timed stop → continue → View final itinerary → My route | Verified |
| Export | Embedded branding in offline HTML and browser PDF; long-entry heading/page-break check | Verified |
| Admin | Visual formatting and structured road/boat route persist; real collection labels; existing product editors and theme control | Verified |
| Access / recovery | Guest/Explorer/Explorer+ and server staff boundaries; direct/back/refresh paths, stale saves, failed maps and retry clearance | Hosted journeys verified; full role matrix covered by backend tests |

## Executed validation

- All 18 unique hosted journeys pass across the initial run and focused reruns. The final two hosted cold-load planner journeys pass with JavaScript deliberately delayed: exports are disabled before the printable portal is ready, then timed additions, HTML download, browser PDF, My route and cleanup complete. Earlier failed attempts are not counted as passes.

- Typecheck, full lint, production build, release-secret/browser-bundle scan and all 119 backend tests pass.
- All 18 unique client-todo desktop/mobile journeys pass across the expanded run and focused reruns. Final planner reruns also pass after measured notice clearance and print-heading corrections. The complete historical Playwright suite was not rerun; some older assertions describe superseded UI.
- Primary UI evidence is the 25 desktop/phone PNGs in `artifacts/client-todo/screenshots.json`. Extra captures cover destination directions, discovery results and lower profile fields. Checks at 375/430/768px verify overflow, header/menu clearance, focused actions, reduced motion and actual profile-name persistence/restoration; primary journeys use 390/1440px. Axe covers profile and planner.
- The fresh finish reviewer inspected all 25 captures. Fixes coordinate profile mutations, expose scoped recovery, display actual collections, protect map retry/list geometry and normalize Back. The original review and its post-fix score are stored locally under `artifacts/client-todo/`.
- Both the downloaded HTML and actual browser print/PDF and offline HTML are branded and contain saved days/times. A nine-page synthetic long-entry sample was visually inspected: the final stop/footer remain present, headings stay with the first stop and no external request is needed. Printer drivers and all possible content lengths are not exhaustively tested.
- The hosted journey audit confirms destination-detail RLS, denied anonymous writes, revoked browser access to the prior save function, fixed definer search path, 385 retained detail records and zero invalid starting points. Schema/function backup precedes the additive migration. No portfolio/trip history is removed; temporary test records are cleaned up.
- DESIGN.md/sidecar, PRODUCT.md, UX-CONTRACT.md, RLS_SECURITY.md and surface briefs record the superseding behavior. Local evidence, backups and credentials remain excluded from Git and deployment.

## Release and remaining setup

- Live: https://unlockparadise-staging.vercel.app. Verified runtime commit `1c60886`; Ready deployment `unlockparadise-staging-lidr2wiuh-ayerkhalidesu-4298s-projects.vercel.app`. The following documentation commit changes no application behavior.
- The current hosted Supabase advisor request was denied. Direct hosted policy/privilege checks passed; no fresh advisor clearance is claimed.
- Failure-state screenshots block tiles deliberately. Separate real-tile live captures at 1440/390px both load successfully with no provider errors; zoom, attribution and dock remain distinct (68/55px zoom-to-dock gaps).
- Google OAuth credentials/provider setup, business SMTP and merchandise payments/fulfillment remain separate pending setup. Merchandise checkout remains closed; local cart additions are not sales.

## Client demo files

- `artifacts/client-todo/client-demo-screenshots.zip`: curated screenshots, preview index and branded synthetic itinerary samples; no credentials, raw traces or database backups.
- `artifacts/client-todo/review-contact-sheet.jpg`: visual index. Full-size captures remain beside it.
- `artifacts/client-todo/release-evidence.json`: scoped results and deployment identity.

The first hosted attempts exposed a shared test-output collision and a cold-load export readiness issue. Output directories are isolated, exports now wait for their mounted document, and both final hosted planner cases pass. Temporary synthetic plans were removed and the final exact-marker account check found none remaining. The fresh finish review returned `ship` for the scored fixes; it is not a claim of exhaustive visual/security coverage.


## Follow-up refinements — 25 October 2026

[CLIENT_REFINEMENTS_DELIVERY.md](CLIENT_REFINEMENTS_DELIVERY.md) records the subsequent one-area planner, day targeting, photo-list/timeline order, simplified profile/directions/cookies, About crop and responsive image delivery. It supersedes this older packet's coordinate-panel and unscoped planner presentation.
