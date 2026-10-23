# Unlock Paradise shared design system

[DESIGN.md](DESIGN.md) records visual intent, accepted token values and runtime ownership. [UX-CONTRACT.md](UX-CONTRACT.md) records workflow, access, validation and recovery. The original theme remains the brand baseline; `phase2.css` and the admin adapter extend it.

| Owner                              | Responsibility                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Modal`                            | Dialog/drawer, top layer, body portal, Escape, focus restoration, safe scrolling                           |
| `useDecision`                      | App-owned confirmations and text entry over Modal                                                          |
| `Tooltips`                         | One delegated focus/hover/tap tooltip for retained HTML and React                                          |
| `Feedback` / `notify`              | Shared dismissible live notice                                                                             |
| `ValidatedForm` / `validateFields` | noValidate, textual errors, aria-invalid/describedby and first-error focus                                 |
| `SearchInput`                      | App-owned clear, focus return and IME-safe editing                                                         |
| `MemberActions`                    | Confirmed save/visited states, pending protection and refresh event                                        |
| `PalawanMap` / `PlanningMap`       | Existing area discovery and reusable plan/search map variant                                               |
| `labelMapControls`                 | Accessible naming for Mapbox 3.4 controls                                                                  |
| `PlaceSearch`                      | Inline planner destination search, stable taxonomy filters, map mode and bounded result expansion          |
| `FloatingCart` / `CartProvider`    | Merch-specific floating action and live browser-local item count using the shared floating-control styling |

All product-owned scrollers inherit tokenized standards and WebKit scrollbar rules, with forced-colors fallback. Focus, selection and caret use the brand palette. Reduced motion preserves static state feedback and removes transitions. Admin has one scoped theme adapter; its explicit ink/inverse tokens prevent public navy defaults from leaking into light surfaces.

## Phase 3.1 extensions

| Owner | Responsibility |
| --- | --- |
| `AdminThemeScope` / `AdminThemeToggle` | Server-compatible initial cookie preference, dark default, admin-only tokens, persistent toggle |
| `AdminBrand` | Existing official mark and studio identity across rail, header, drawer and MFA |
| `travelFlight` / `FlightLifecycle` | Measured cubic SVG/product travel, local fallback, reduced motion, bounded concurrent overlays and cleanup |
| `FlightCount` | Animate actual store values without manufacturing count state |
| `useFloatingClearance` | Measure page controls, product copy and footer links, reserve a clear dock position and settle endpoints before flight |
| `AddToBag` in store.tsx | Shared validated variant/quantity submission for catalog and detail |
| Repository card markup / `SiteBehavior` | Focusable photo group outside the title link; arrow/Home/End browsing and swipe guard |

Card anatomy: `--p2-card-inset: 20px`, `--p2-card-compact: 16px`, `--p2-card-gap: 12px`. Featured card body is a block and its itinerary action stays inside the same white surface. Destination body padding uses the shared inset. Product links and purchase controls are separate semantic siblings. Long names wrap naturally.

Runtime ownership remains Model B: `phase2.css` owns the public palette and card/flight styling; `admin.css` owns `--studio-*` and adapts shared `--p2-*` only inside `[data-admin-theme]`. Shared Modal propagates context into the body portal; the tooltip copies its nearest active scope. Native controls retain browser semantics and active color-scheme.

See MOTION_SYSTEM.md, ADMIN_THEMES.md and VISUAL_REGRESSION.md for actual behavior, evidence and limitations. The previous phase results remain historical records.

Native select and date popups are intentionally platform-owned; no custom popup geometry or locale claim is made. Browser checks cover keyboard selection, narrow layouts, scrolling, dialog cancellation and form recovery. The final route matrix and executed tests are in PHASE_2_TEST_RESULTS.md.
