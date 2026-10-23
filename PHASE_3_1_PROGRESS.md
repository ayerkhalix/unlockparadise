# Phase 3.1 — visual refinement

Status: complete for the documented route/state coverage. Implementation, captured evidence, bounded independent review and documentation are reconciled. No production deployment or WordPress changes.

## Baseline, 20 October 2026

Real Chrome/Playwright audit: 336 route/state/viewport combinations, 56 distinct states, six widths (375, 390, 768, 1024, 1440, 1920), 112 axe scans. Screenshots and machine results: `artifacts/phase3-1/before/`. All ten contact sheets inspected. Authenticated captures use isolated synthetic staging identities; a temporary planner trip was removed in cleanup.

No horizontal overflow, broken visible images, unnamed buttons, or browser runtime errors detected in these captures. This is measured coverage, not a WCAG certification.

| Priority | Evidence | Shared owner | Resolution planned |
| --- | --- | --- | --- |
| P1 | Featured titles/metadata touch white card edges | featuredMarkup + shared CSS | Block body, intentional inset and contained action |
| P1 | Photo strips inaccessible to keyboard in two axe scans | repository card markup + strip controller | Separate photo group and keyboard scrolling |
| P1 | Save only pulses; merchandise flies straight | MemberActions / cart-animation | Shared cubic flight with real endpoints |
| P1 | Generic mountain merchandise hero | Store | Compare two actual-product editorial directions |
| P1 | Admin lacks official logo and theme choice | AdminConsole / MFA / admin.css | Official mark, default navy, persistent scoped light option |
| P2 | Expanded Place summary has a 22px target | Admin form details | 44px summary control |
| P2 | Contact native select and textarea differ from dark form | SureForms compatibility CSS | Canonical form surface and spacing |
| P2 | Admin member modal uses public navy in light studio | Shared Modal / theme context | Inherit scoped admin tokens in portals |

## Safety boundaries

Preserve all existing user changes, real member trips and existing staging records. No schema changes are planned. Checkout stays closed. Motion starts only after the existing save succeeds; local bag behavior and actual variant validation remain authoritative.

## Implemented

Shared 20px destination/Featured insets, contained Featured actions, keyboard photo strips, Contact native-control styling, shared measured plane/product motion, actual-value count feedback, catalog and detail Add to bag forms, a selected actual-product editorial hero, official admin identity, scoped persistent dark/light themes, useful shortcuts before attention items and a narrow MFA frame. The floating dock measures page controls, product copy and footer links and uses the lowest clear edge position; if none exists, it hides and flights use the local fallback. Initial dialog portals now wait for hydration so planner deep links do not create a server/client mismatch.

## Executed checks

- 67 backend tests passed.
- 9 real staging authentication, MFA, RLS, Storage and entitlement acceptance checks passed.
- The broad browser run passed all 39 public/admin/security cases outside Phase 2 and new motion tests, with five expected viewport/configuration skips.
- Phase 2's complete desktop/mobile rerun passed all 32 cases.
- The final 16-case motion/theme/clearance and initial-dialog hydration run passed on desktop and phone. The strengthened footer/form clearance check also passed separately on both viewports. Four targeted bag-flight and product-copy clearance cases passed after the final selector adjustment.
- Final TypeScript, ESLint, production build and release-secret checks passed again after the last runtime change.
- Premium strict static audit reports eight existing delegated/library-action parser false positives; changed-markup Impeccable detector returned no findings.

The initial broad run exposed shared synthetic-session interference when a separate acceptance run signed out Explorer during cleanup. Cleanup now renews both cleanup-only fixture sessions when necessary. The exact stranded Explorer trip and two verified desktop test Places were removed, with their recommendation references cleared first. No broad record deletion was used. Browser/acceptance suites should run sequentially when they share these identities.

## Independent review

First verdict: `fix`. Material list: dock/form/footer collisions; phone shortcut priority; clipped compact size placeholder; MFA width/gutters; durable product/design context. The first verdict pass scored all five resolved and caught one consequence of relocation: the phone dock covered tote metadata. Product titles and metadata are now included in clearance protection. Four targeted desktop/phone bag-flight and clearance checks passed after that change, and all six catalog widths were recaptured. The second and final verdict pass scored that finding resolved at 390px and confirmed the 1440px capture remained unobstructed: `ship`, with no remaining scored fixes. This verdict covers the scored fixes, not a new whole-site certification. The detector was not rerun.

## Final captured evidence and integrity

420 combinations / 70 states / six widths; 140 axe scans; zero final overflow, unnamed-button, broken-visible-image, runtime-error or axe flags. Twenty meaningful before/after pixel pairs were generated. Two phone comparisons were omitted because their original async screenshots did not show the same open state. Both admin themes and all final editor/dialog/MFA states were explicitly awaited.

Real staging integrity was checked after test cleanup: 384 Places including the preserved earlier acceptance record, four original products, 12 variants with unknown stock retained, zero orders, zero analytics events and zero temporary Phase 3.1 trips. The user's preserved itinerary still has two stops. See `artifacts/phase3-1/integrity.json`.

The eight required deliverables are this report, UX_AUDIT.md, DESIGN.md, DESIGN_SYSTEM.md, MOTION_SYSTEM.md, ADMIN_THEMES.md, MERCH_HERO_REDESIGN.md and VISUAL_REGRESSION.md. PRODUCT.md and the design sidecar retain the accepted product/design context. The local preview remains available at http://127.0.0.1:3000.

For coverage limits and reproduction commands, see VISUAL_REGRESSION.md. The installed Impeccable launcher exposes no official DESIGN lint command; custom parsing, source-reference and narrative-parity validation plus Prettier passed instead. No official lint pass is claimed.
