# Phase 3.1 visual verification

20 October 2026. Local Next.js application against pinned staging; no production deployment.

## Executed visual coverage

The before inventory captured 336 combinations across 56 route/UI states at 375, 390, 768, 1024, 1440 and 1920px. It includes 112 axe scans. Some early async editor/member-dialog images captured the loading/list state; those images are not proof of a settled open editor or dialog. The final after harness explicitly waits for the editor heading and open native dialog before capture.

The final after matrix contains 420 combinations across 70 states, with 140 axe scans at 390 and 1440px. It includes both admin themes. Machine results: `artifacts/phase3-1/after/results-all.json`; route inventory and 12 contact sheets live beside it. Current final flags: zero horizontal overflow, unnamed visible buttons, broken visible images, browser page errors or axe violations. Axe coverage is not full assistive-technology certification.

Public coverage: home and scrolled Featured cards; About; membership; Contact; login, join, recovery and expired-reset state; privacy/terms/refunds; four area archives; eight category archives; area/category combination; guest Place; storefront; product detail; empty and filled cart; unavailable checkout.

Authenticated Explorer+ coverage: account, account menu/mobile navigation, portfolio, visited, Bucketlist, Bucketlist drawer, planner, inline destination selector, three representative Place guides, destination card tooltip/photo strips. Temporary audit trips are owner-created and deleted in cleanup; existing user trips are not reset.

Admin coverage in dark and light: overview, Places, merchandise, orders, analytics, members, reviews, settings; expanded Place and product editors; open member dialog; native Status dropdown; MFA entry at AAL1. Browser/OS-owned popup appearance is exercised but its geometry is not asserted as a custom component.

## Comparisons and motion

`node tests/phase31-visual-compare.mjs` produces 20 selected pixel comparisons in `artifacts/phase3-1/comparisons/`. Intentional redesigns have nonzero differences; no zero-diff claim is made. Phone member-dialog and MFA baselines include the earlier loading-state limitation, so those two pairs are omitted from pixel comparison. Their final open states are independently captured and tested. Account and planner retain their original workflow/layout.

Actual paper-plane/product animations have four sampled browser frames at 0, 200, 400 and 720ms, coordinate measurements and curve-deviation assertions for desktop and phone. Evidence: `artifacts/phase3-1/motion/`. Tests also cover failed save/no success flight, real retry/persistence/removal, rapid quantities, hidden-target local fallback, reduced motion, resize cancellation and reload. Playwright videos live with browser test results.

The independent finish review's five material findings were corrected and scored resolved. Its first verification found a catalog metadata collision caused by dock relocation; product copy was added to clearance protection and all six catalog widths recaptured. The final verification returned `ship` for the scored fixes, with no remaining finding. Exact final response: `artifacts/phase3-1/finish-verdict.md`. This bounded verdict does not expand the route or assistive-technology coverage above.

## Reproduction

Use the configured local staging environment and isolated synthetic fixtures. Keep authenticated suites sequential because they share fixture identities. Start `npm run dev` in a separate terminal. The following PowerShell commands reproduce the final matrix without overwriting the before evidence:

```powershell
$env:AUDIT_STAGE='after'
Remove-Item Env:AUDIT_ROLE,Env:AUDIT_IDS,Env:AUDIT_RESUME,Env:AUDIT_FRESH_WIDTH -ErrorAction SilentlyContinue
node --env-file=.env.local --import tsx tests/phase31-audit.mjs
node artifacts/phase3-1/contact-sheets.mjs
node tests/phase31-visual-compare.mjs
```

The audit creates and removes one temporary owner-scoped itinerary; it does not reset existing trips. Run these regressions sequentially, with the local environment explicitly loaded for authenticated browser tests:

```powershell
npm run test:backend
npm run test:staging:authenticated
node --env-file=.env.local node_modules/@playwright/test/cli.js test tests/phase2.spec.ts --workers=1
node --env-file=.env.local node_modules/@playwright/test/cli.js test tests/phase31.spec.ts --workers=1
```

Run `npm run typecheck`, `npm run lint`, `npm run build` and `npm run check:release` after browser captures finish, so build activity does not interrupt the development server during navigation.

## Limits

This audits shared templates and named representative records, not every individual destination or historic export alias. Chrome desktop/mobile emulation was used; physical iOS/Android keyboards, Safari, Firefox, screen-reader sessions and a complete 200% zoom matrix are outside this run. No live checkout is available or enabled. Native selects/date controls remain platform-owned.

Static Premium audit has eight known parser false positives for existing delegated data-attribute actions and library-owned gallery arrows. Their real owners and browser coverage are documented in UX_AUDIT.md. Impeccable detector ran once on changed markup with no findings.

The installed Impeccable launcher has no official DESIGN lint command. The documenter verified YAML/JSON parsing, UTF-8, source token/reference validity, exact DESIGN/sidecar narrative parity and Prettier; this is not reported as an official lint pass.
