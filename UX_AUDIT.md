# Unlock Paradise UI/UX audit

## Phase 3.1 — 20 October 2026

The new before inventory contains 336 captures at six widths; a few earliest async editor/dialog captures show loading/list state, so they are not counted as proof of settled overlays. Final after verification explicitly awaits those states: 420 route/state/width combinations, 70 states, 140 axe scans. The six widths are 375, 390, 768, 1024, 1440 and 1920px. See VISUAL_REGRESSION.md for the complete named route groups, reproducible commands and limits.

| Priority | Concrete finding | Owner and change | Evidence |
| --- | --- | --- | --- |
| P1 | Featured text flush against card edges | Repository featured markup + phase2.css: block body, 20px shared inset, contained itinerary action | Featured screenshots; computed inset test |
| P1 | Member photo strips lack keyboard access | Repository card structure separates focusable photo group from title link; SiteBehavior supports arrows/Home/End and swipe guard | Keyboard browser test and clean axe scans |
| P1 | Save confirmation has no traveling plane | Existing MemberActions launches shared SVG flight only after confirmed mutation | Actual coordinate/curve samples, failure/retry and persistence tests |
| P1 | Product flight is linear and only detail supports adding | Shared AddToBag form for catalog/detail; actual selected thumbnail follows measured cubic | Variant/quantity/reload, rapid addition and frame tests |
| P1 | Generic mountain merch hero | Product-led split editorial chosen after two real browser directions | MERCH_HERO_REDESIGN.md; six-width screenshots |
| P1 | Admin lacks official mark and theme preference | Shared official brand, navy default and scoped cookie-backed dark/light adapter | Both-theme module/editor/MFA captures and SSR/reload/keyboard tests |
| P2 | Member dialog ignores light studio palette | Shared Modal carries active scope into body portal; tooltip copies nearest scope | Open portal screenshots and computed color-scheme test |
| P2 | Place details summary is 22px high | Shared admin summaries and actions favor 44px targets | Recaptured expanded editors, axe |
| P2 | Contact select/textarea inherit inconsistent legacy styling | Specific retained SureForms adapter, dark native select, textarea and placeholder styling | Contact screenshots, computed resize/color-scheme tests |
| P1 | An initial planner dialog creates a hydration mismatch | Shared Modal renders its portal after the client hydration snapshot, preserving focus and top-layer behavior | Fresh deep-link browser test on desktop and phone |
| P2 | Overview has verbose activity and vague shortcuts | Five real recent events, readable action labels and explicit existing workflows | Both-theme overview screenshots; existing admin journey tests |
| P1 | Floating controls cover form actions, footer links or catalog metadata | Shared measured clearance protects fields, actions and product copy; relocates along the viewport edge or hides when no slot exists | Desktop/phone geometry tests, six-width catalog recapture, final independent verdict |

No P0 was identified. The final machine audit reports zero horizontal overflow, unnamed visible buttons, broken visible images, runtime page errors or axe violations. This is bounded template/state coverage, not an individual audit of all destination records or full screen-reader certification.

Static Premium strict audit reports eight existing parser false positives: delegated itinerary and member action buttons in bucketlist, destination-detail, member-page, place-actions and recommendations, plus two library-controlled gallery arrows. `TravelCompanion` and `MemberActions` own the delegated operations; Gallery initializes Swiper navigation. Existing real browser journeys exercise all of these. They are not disabled or assigned duplicate handlers merely to satisfy static literal-button parsing. The Impeccable changed-markup detector ran once and returned no findings.

Current evidence is organized under `artifacts/phase3-1/{before,after,comparisons,motion,hero-directions}`. Previous phase evidence below is retained as historical verification.

## Phase 2 historical audit

19 October 2026, Asia/Manila. Impeccable was invoked for the final technical and visual pass. This audit extends the existing application and preserves the original brand, content and permission model.

## Scope and evidence

The executed route audit contains **392 checks across 56 route/UI states** at **375, 390, 430, 768, 1024, 1440 and 1920px**. Axe ran WCAG 2 A/AA, 2.1 AA and 2.2 AA tags at 390 and 1440px: **112 scans**. The final captured matrix has zero horizontal overflows, unnamed visible buttons, broken images, runtime page errors or axe violations. Contact form center offset is 0px at all seven widths.

Evidence: ignored `artifacts/phase2/audit/final-results.json`, route screenshots and `artifacts/phase2/visual-diffs/results.json`. Fourteen before/after images were compared with pixelmatch. Changes to navigation, Contact layout, save controls and featured cards are intentional; this is a reviewed visual comparison, not a zero-pixel-difference assertion.

These results cover the significant shared page templates and states below, not an individual review of every one of the 383 destination records. Automated axe scans are not a claim of full assistive-technology conformance.

## Findings and implemented fixes

| Original issue                                                             | Affected route/component                           | Severity | Implemented fix                                                                         | Verification                                                    |
| -------------------------------------------------------------------------- | -------------------------------------------------- | -------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Six home category controls lacked valid URLs                               | Home hero                                          | P1       | Real taxonomy-backed anchors                                                            | Every category, results, keyboard, mobile, back/forward         |
| No global saved-place access                                               | Discovery/member pages                             | P1       | Count, drawer, full Bucketlist and cross-links                                          | Authenticated save/remove/reload and drawer focus               |
| Save failures were unclear and repeated controls drifted                   | Cards/detail/member actions                        | P1       | One confirmed mutation flow, disabled pending controls, shared notice and refresh event | Real writes plus synthetic 503                                  |
| Portfolio star implied a different action                                  | Account/portfolio                                  | P2       | Set as account featured place                                                           | Verified source operation and accessible label                  |
| Tooltip systems disagreed and could clip                                   | Retained HTML and React                            | P1       | One delegated focus/hover/tap system inside active top layer                            | Focus, Escape and transport tooltip tests                       |
| No persisted trip planning                                                 | Member/discovery pages                             | P1       | Owner/version-isolated trips, days, stops, notes, search and maps                       | Database, live API and full UI CRUD                             |
| Dragging from an interactive stop body was unreliable                      | Planner                                            | P1       | Dedicated pointer handle, drop validation, visible drag state and arrow alternatives    | Actual pointer drag and keyboard-button reorder                 |
| Floating Bucketlist obscured a mobile save action                          | Planner/forms                                      | P1       | Hide during form focus; compact phone control; safe-area spacing                        | Mobile note save and screenshots                                |
| Contact form inherited a left-aligned narrow parent                        | Contact                                            | P2       | Center parent and existing form column                                                  | Seven-width geometry and screenshots                            |
| Contact topic was ignored and marked aria-hidden                           | Contact                                            | P1       | Accessible named select and persisted allowlisted topic                                 | API contract and axe                                            |
| Generic duration could imply hike/boat time                                | Cards/detail/admin                                 | P1       | Separate verified fields; mountain Hike time; explicit unknowns                         | Synthetic values, real imported boat records, admin save        |
| Dense source descriptions lacked hierarchy                                 | Place detail                                       | P2       | Sanitized editorial guide preserving original and distinct secondary content            | Content/source-link/XSS checks and visual review                |
| No curated recommendations                                                 | Detail/admin                                       | P1       | Ordered published relationships, real search, preview and save                          | RLS, admin and browser persistence                              |
| Merch was disconnected from main site                                      | Merch routes                                       | P1       | Real catalog/assets/variants/local bag under main shell                                 | Reload, quantity, remove and ordering-unavailable checks        |
| Account/logout navigation was scattered                                    | Header/mobile menu                                 | P2       | Avatar disclosure, feature links, real logout                                           | Keyboard/tap, Escape and session invalidation                   |
| Profile fallback referenced a missing SVG                                  | Account                                            | P2       | Existing vector icon fallback                                                           | Broken-image audit                                              |
| Mapbox attribution lacked a mobile accessible name                         | Home/detail/planner/admin maps                     | P1       | Shared Mapbox control naming                                                            | Narrow axe scans and unnamed-control audit                      |
| Hidden/reshown map could keep wrong canvas geometry                        | Mobile planner                                     | P2       | ResizeObserver and explicit loading/failure list fallback                               | Real map selection and responsive views                         |
| Admin text inherited navy white-ink variables on paper                     | Admin console/editor/MFA                           | P1       | Scoped dark ink, links and focus colors                                                 | Every admin tab and editor axe scans                            |
| Preview inherited paper admin styles and nested main layout                | Admin preview                                      | P1       | Authentication-only layout; separate admin and preview surfaces                         | Seven-width preview confirmation                                |
| Native prompts interrupted product flows                                   | Admin, planner, reviews, merch, source-link editor | P2       | Shared app-owned modal decisions with Cancel focus                                      | Cancellation, deletion and focus checks                         |
| Form validation relied on browser bubbles                                  | Auth/contact/member/admin/trip forms               | P2       | Shared noValidate, text errors, aria associations and first-error focus                 | Invalid submit and recovery tests                               |
| Remote search could dispatch partial/racing queries                        | Place/recommendation/admin search                  | P2       | Composition-safe clearable input, debounce and cancellation                             | Search/filter/browser checks                                    |
| Production floating text could lose contrast during hover or entrance fade | Shared floating control                            | P1       | Explicit shared hover ink and persistent full-opacity mount                             | Production computed-color, axe and rebuilt browser confirmation |
| New scrollers and reduced-motion behavior drifted                          | Shared UI                                          | P2       | Tokenized global scrollbars and static reduced-motion state feedback                    | Computed/style inspection and shared rules                      |

P0 = blocking task failure; P1 = major usability/accessibility issue; P2 = minor difficulty with a workaround. Confirmed P1 findings above were fixed rather than left as recommendations.

## Routes reviewed

Public: `/`, `/about/`, `/membership/`, `/contact/`, `/login/`, `/join/`, `/forgot-password/`, `/reset-password/`, `/privacy-policy/`, `/terms/`, `/refunds/`, `/checkout/` (guest redirect), `/get-paid/`; all four area landing routes; `/area/ppc-north/beaches/`; all eight category archives; `/place/bayog-beach/` guest gate; `/merch/`, product detail, bag and checkout.

Members: `/account/`, `/bucketlist/`, `/visited/`, `/portfolio/`, itinerary list/new/persisted planner, real boat and café details. Synthetic mountain/boat guides, recommendations and editor states are covered by the feature browser suite. Existing Explorer, Explorer+, expired-member and MFA-admin boundaries are covered by hosted acceptance.

Admin: dashboard, MFA, Places, Media, Reviews, Users, Memberships, Entitlements, Settings, Contacts, Activity, Payments, Events, actual Place preview, Edit Place and Add Place. The two editor captures are separate states of the same console route.

Interaction states: loading, empty/no-results, invalid form, failed save, retry, saved/reloaded data, conflict, disclosure/drawer open and closed, confirmation cancellation, map marker and list selection, pointer/arrow reorder, gallery open/advance/Escape, bag variants and signed-out navigation.

Legacy export aliases such as `/hello-world/`, `/category/uncategorized/`, `/form/` and `/form/simple-contact-form/` are outside the significant application route matrix; they retain source-export content. The audit does not describe these as reviewed product flows.

## Impeccable and static review

Implementation integrity: the discovery map, real Palawan content, original typography, shared member actions and task-specific planner make this a coherent extension of the existing product. The audit health assessment is **16/20 (Good)**: accessibility 3, performance 3, responsive design 4, theming 3, integrity 3. This is an engineering review assessment, not a certification or performance benchmark.

The Impeccable detector recorded 90 initial findings: three thick side accents (reduced to 1px) and 87 advisory color/radius literals, largely semantic states, inherited paper surfaces and component shapes. The existing runtime CSS remains canonical; the advisory inventory is retained in `artifacts/phase2/impeccable-detect.json`. Broad token consolidation is an optional maintenance task, not a new visual redesign.

The premium static auditor correctly checked native select/date ownership, contracts and form rules. Its remaining 13 actionless-button findings are verified false positives: delegated `data-*` actions, tooltip targets, and Swiper-bound gallery arrows. They have real document/library handlers and runtime checks. The strict tool exits 1; it is not reported as a clean static pass. No no-op handlers were added to silence it.

## Outstanding limits

Physical iOS/Android devices, Safari/Firefox, screen-reader sessions and field testing on unreliable mobile networks were not executed. Native popup geometry belongs to the supported browser/OS. Exact fees/durations and recommendation relationships still require source-backed editorial entry. Commerce ordering, production email delivery and payment-provider acceptance remain external gates. Full final test status is in PHASE_2_TEST_RESULTS.md.
