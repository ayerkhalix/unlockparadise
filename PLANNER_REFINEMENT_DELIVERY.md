# Planner, navigation and profile refinement

Approved 25 October; release verification completed 26 October 2026.

## Delivered behavior

- The selected day has **Itinerary**, **Schedule** and **My route** views. Schedule includes flexible visits and an explicit empty state. Notes are always visible, with a smaller inline icon and explicit Save note.
- One **Add destination** card sits below each view, including the route map. Its choices are Search destination and Explore options. The destination browser also links back to My route and Schedule below its results.
- The browser keeps the normal white Places cards and transport/assets/Explorer+ filters, plus Name / Date added / Top rated sorting. It omits All destinations and the search/travel-time filters. Bucketlist controls are available on its cards and inline search results, using the existing member controller, confirmed state, failure handling and Undo.
- Same-day reorder gives destinations their new position’s saved time slot, including flexible slots. Notes stay attached to the destination. Cross-day moves append and retain the saved visit time. Draft guards prevent silent loss.
- Destination Return and browser Back restore the source category, filters, shown count and click-time position. Photo/gallery links and title links are distinguished. Restoration waits for archive filters; category navigation initializes each new feed. Back to categories reopens the correct home map area and phone category page.
- Mobile navigation leads with the linked account picture/name, then primary links, Itinerary Planner, My Portfolio and Log out. Bucketlist is omitted from this menu. The original drawer, tagline and legal footer remain. Desktop account links are unchanged.
- Profile collections swipe horizontally on phones with snap points, keyboard support and previous/next controls. The selected featured place has a visible photo and selected star.
- Membership explicitly lists itinerary planning. The redundant free-account prompt and discount/savings wording are removed. **All plan prices remain unchanged.**

## Data safety

Migration `20261025152853_itinerary_position_time_slots.sql` wraps the existing versioned planner transaction. The parent trip lock, premium/owner/day/full-order checks, and single version increment remain authoritative. Previous internal helpers cannot be called by authenticated or anonymous clients. Non-reorder actions retain their canonical behavior. A private backup of existing trips, stops and function definitions precedes the migration.

The baseline at migration time was 16 trips, 2,930 photo associations, 7 merchandise products and 3,437 media records. Verification fixtures use newly created trips and record original profile/Bucketlist state. Timed-out profile test fixtures were reconciled from their recorded before-state; subsequent tests have a separate cleanup hook. Existing destination records, original pictures and product image data were not rewritten. The final read-only comparison is stored in `artifacts/planner-refinement/data-audit.json`.

## Verification

- Backend suite: 125 tests passed, including atomic position-slot assignment, notes, flexible slots, stale/foreign/partial/duplicate rejection and cross-day retention. The additional safe-return unit test passed.
- Type checking, production build, ESLint and release/secret checks pass.
- Desktop and 390px phone journeys cover views/notes/schedule, exact reorder results, original facets, Bucketlist actions, same-tab return position, native Back, category-to-category filtering, home category restoration, menu order, swipe controls and featured-place persistence. Existing save failure/Retry save, exact Undo, image fallback and edge-to-edge featured frames remain covered.
- Scoped Axe checks cover planner and exploration; snapshots are in ignored `artifacts/planner-refinement/`. The screenshot helper keeps modal captures inside the viewport and excludes inert notifications.
- Design lint has zero errors and 32 existing warnings. The premium audit retains eight known delegated-action/Swiper findings, verified through runtime behavior.
- Supabase advisors remain unavailable through the connector (permission denied); no fresh advisor clearance is claimed. Owner/version/permission behavior is tested directly.

## Release

Source is published to `main` and `codex/staging-release` in `ayerkhalix/unlockparadise`. Vercel builds `main` for [unlockparadise-staging.vercel.app](https://unlockparadise-staging.vercel.app/). Commit, deployment/alias confirmation and hosted acceptance output are retained in the private artifact directory. Hosted browser acceptance uses the canonical staging alias. No real payment or outbound-email transaction is part of verification.


## Safari visit-time follow-up — 26 October 2026

The client identified Safari hour/minute editing as the problem. The shared picker now uses independent native hour, minute and AM/PM selects, preserving the complete HH:mm model. Both add flows and saved-stop editing use the same component. Drag/reorder behavior and database state are unchanged. Native selectors retain standard keyboard and OS behavior without browser detection or a custom popup.

Regression journeys cover field-to-field Tab navigation, repeated minute/AM-PM changes without resets, invalid ranges, save/reload, 12 AM / 12 PM conversion, clearing to flexible time, and adding through Explore options. Evidence is under ignored artifacts/safari-time; Chromium and WebKit run at desktop/phone widths. A physical Mac remains a client verification step.
