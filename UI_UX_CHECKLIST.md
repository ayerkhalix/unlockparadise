# UI/UX checklist — 30 October 2026

This expands the [29–30 October audit](UI_UX_AUDIT_2026_10_29.md). Checked items are implemented; verification details are recorded below. Open items distinguish confirmed limitations from further checks, rather than presenting every suggestion as a defect.

## Mobile density and images — current pass

- [x] Bring login and registration content higher: remove the inherited 110px top padding, use the 64px phone header and 20px content inset.
- [x] Reduce public auth, membership, contact and legal headings to 24px on phones. These pages previously escaped the app's compact sizing rules.
- [x] Reduce app/library titles to 24px, trip/section titles to 20px, subheadings to 16px and drawer links to 14px.
- [x] Compact membership comparison padding and type, contact spacing and the About introduction; retain the existing homepage hero composition.
- [x] Compact category return navigation and reserve header clearance; reduce category/destination titles to 26px.
- [x] Keep native text entry at 16px and touch controls at least 44px while reducing visual bulk. Reduce the mobile admin title to 26px.
- [x] Fix the contact form's reason selector inheriting a 9.8px font on phones; retain a 16px native selector and 44px minimum height.
- [x] Bring normal destination-list sort/search fields into the same 16px/44px phone standard; they previously retained 13.5–14px text and 34–38px heights.
- [x] Replace the fixed 640px public cover-preview pipeline with responsive 256/384/640/1080/1920px previews selected from adequate stored files.
- [x] Include preview width in the versioned cache key. Recheck publication/current cover on every request, including conditional cache hits.
- [x] Preserve source files, focal metadata and private-media boundaries; avoid runtime Supabase image transformations and artificial upscaling.
- [x] Inventory small published destination covers against their associated WordPress originals. Eighteen covers are below 1080px wide; four are below 768px. All eighteen associated originals have the same dimensions as their current display source.

## Confirmed remaining work

- [ ] **P1 — Better source photographs:** obtain replacements for those eighteen destination covers, prioritizing the four below 768px and any used in wide layouts. The record-level inventory stays in ignored local evidence because it includes protected destination identities.
- [ ] **P1 — Product photograph:** obtain a larger real source for Forge Your Path Tee; its current source is only 387 × 516px.
- [ ] **P2 — Prevent repeat uploads:** add a non-blocking source-dimension warning in admin, explaining which display slots are suitable. Do not reject a deliberately small icon or claim that lossless source retention improves a low-resolution input.
- [ ] **P2 — Demo catalog hygiene:** review historical synthetic `browsing-…` / `[TEST]` records with the owner before archiving any. This pass does not delete historical records.
- [ ] **P2 — Legacy browser coverage:** update specs that still depend on old fixtures and retired cookie controls. The focused changed-workflow tests remain the evidence for this release.

## Additional checks to work through

- [ ] Test landscape phone layouts with the software keyboard open: time selects, notes, search results and bottom actions must remain reachable.
- [ ] Check 200% text zoom and long names in itinerary cards, menu identity and account membership rows; allow wrapping without clipping controls.
- [ ] Exercise long destination titles, missing photos and mixed portrait/landscape galleries at 320px and high device density.
- [ ] Measure slow-network image behavior: the visible frame should load before offscreen gallery/crossfade frames, without blank flashes or layout jumps.
- [ ] Check profile avatars on 2×/3× screens. Existing profile uploads deliberately retain only a 192px square; assess a larger bounded copy for future uploads, with the private-photo and privacy-copy contracts kept in sync.
- [ ] Verify the retry/recovery path after going offline during itinerary save, media upload and catalog refresh; preserve entered drafts and distinguish failure from empty results.
- [ ] Recheck browser Back after pagination, category changes and loading more cards, including a cold document return; preserve the exact source position and focus.
- [ ] Review touch and keyboard parity for photo-delete, itinerary-day delete and three-line stop actions; hover must never be the only way to find an action.
- [ ] Check all empty, loading, expired-membership and denied-access screens for one clear next action and consistent wording.
- [ ] Review light/dark admin contrast on validation errors, disabled controls and photo upload progress, rather than only the default dashboard.
- [ ] Run a controlled checkout cancellation/failure/retry walkthrough and a successful membership activation; keep provider test/live modes explicit.
- [ ] Complete Google provider activation, business-email SMTP and a controlled signup/recovery inbox test before public registration is declared launch-ready.
- [ ] Confirm merchandise payment, delivery, inventory and refund requirements with the client before enabling paid merchandise checkout.

## Previous audit fixes retained

- [x] React-owned password visibility controls and preserved auth validation.
- [x] Readable, reachable map attribution and non-overlapping 44px map buttons.
- [x] Current-page navigation feedback and Safari drawer focus return.
- [x] Mobile admin action targets and readable catalog option loading labels.
- [x] Full responsive image candidates after load; fixed featured-card side bars and gallery request sizes.
- [x] Original-preserving upload pipeline and prepared local homepage/map/merch derivatives.

## Evidence

Before measurements cover 320px and 390px phones; screenshots and the private source inventory are in `artifacts/mobile-quality/` (ignored). Before this change, login/registration cards began around 200px down the screen and public headings ranged from 32–38px. The corrected auth card starts at 84px. Automated checks added in `tests/mobile-density-quality.spec.ts` cover 320/390/430px layouts, native input readability, responsive preview dimensions, ETags, invalid widths and anonymous private-media denial. Source limitations remain open regardless of test results.

Verification completed for this pass:

- All 136 backend checks passed, including access isolation and original-image preservation.
- Chrome phone passed the new layout/preview tests and the existing exact-position Explore options Back/Return test. Shared auth, navigation, admin, map and high-density itinerary-image checks also passed.
- Safari/WebKit phone passed all seven layout/preview, high-density image and shared UI checks.
- The layout test covers 320px, 390px and 430px widths; representative desktop captures confirm the desktop title scale remains unchanged. After captures cover auth, membership, contact, About, destinations, account and the itinerary library.
- Production build, TypeScript, ESLint and release-secret checks passed.
- The scoped Premium strict audit passed with zero findings. Impeccable reported no primary findings; type-ramp advisories were reviewed against the documented mobile exceptions. This is a scoped review, not a complete accessibility certification or a claim that every legacy browser spec ran.
