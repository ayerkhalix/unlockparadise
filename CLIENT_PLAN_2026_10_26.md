# Client refinement plan - 26 October 2026

Source: `C:/Users/Ayer/Downloads/plan.pdf`, all five pages, including the screenshot references. Baseline: staging commit `96b5f40`.

The owner approved this plan and its date policy on 26 October 2026. Implementation and verification are recorded in CLIENT_PLAN_DELIVERY.md. The PDF supplies the requested changes; current shared components and access rules supply the implementation constraints.

## Outcome

Make itinerary planning easier to scan and operate, provide one schedule for the entire trip, simplify profile navigation, and make membership actions match the signed-in account. Keep the existing navy, teal, gold, photography, white destination cards and typography. Follow the supplied compositions rather than introducing another dashboard style.

## 1. Destination cards and exploration filters

References: PDF pages 1 and 5.

- Match the reference toolbar: icon-and-text segmented controls for Motorcycle, Car, 4x4, Boat and Hike; an Explorer+ pill; sort control/direction; and a small reset action.
- Omit the travel-time slider and destination-name search in Explore options. Use the reference's visible control layout rather than the current Filters disclosure and separate Assets checkbox block. Retain the current Name, Date added and Top rated sort choices; do not introduce a travel-time sort.
- Preserve multi-select transport behavior, selected/focus states, the trip's single area, category selection and target-day selection. Reset clears facets without losing the trip/day/category.
- Remove Show more destinations from Explore options. Present the complete matching area/category result set after loading; ensure a server response/page limit does not silently truncate it.
- Reserve image frames and prioritize visible images. Photos further down can load as they approach the viewport, without requiring a Show more click.
- Give normal, Explorer+, missing-photo and long-title cards the same responsive image aspect ratio and consistent white-body height. Reserve equivalent metadata space on locked cards without revealing protected names/details.
- Keep proportional image delivery, cover fitting with existing focal points, and the shared failure fallback. Do not stretch photographs or reintroduce side bars.

Primary owners: `PlannerBrowser`, the retained Places toolbar/card styling, `ContentImage` and the shared card CSS. Apply the card geometry consistently to normal Places and planner exploration rather than fixing one grid independently.

Acceptance: reference-style filters; all matching cards reachable without a load-more action; equal image/body alignment; mobile controls wrap cleanly; Bucketlist, add-to-day and return state still work.

## 2. Planner search and day management

Reference: PDF page 2.

- Replace the Search destination toggle with a real search field in that top position, beside Explore options on wide screens and stacked on phones.
- Remove the duplicate search field below. Keep destination results visible when the query is empty; typing filters them by name within the trip's area.
- Remove the inline search's Show more gate too, so the always-visible result list is complete. Retain result counts, loading, retry, no-results, Add/Added states and Bucketlist actions.
- Remove Trip options from the main toolbar.
- Add a small, separate Delete day control to each day tab. Reveal it on hover/focus for pointer use; keep it directly available on touch. Avoid nesting a delete button inside the day-selection button.
- Use the existing application confirmation dialog. Name the day and date and show how many stops, notes and visit times will be removed. Cancel is the safe initial action.
- Confirmed user decision: deleting a day removes that day and all of its stops after confirmation. It does not move those stops elsewhere or delete destination records.
- Add a transactional, owner/version-checked delete-day action. The current mutation contract supports adding days, individual-stop removal and whole-trip deletion, but not deleting a day.
- Only update the UI after the server confirms. Retain the existing saved/error/retry/conflict behavior and unsaved-note/time protection. Select a surviving day after deletion.
- Keep whole-trip deletion available within Edit trip, with its existing explicit confirmation; removing the Trip options menu should not strand that capability.

Date policy confirmed by the owner on 26 October 2026: keep the start date, close the gap by renumbering later days, and shorten the end date. Keep at least one day in a trip. The confirmation must show the resulting dates; do not silently choose a different date policy.

Primary owners: `PlaceSearch`, `ItineraryPlanner`, `planMutation`, the existing transactional planner service and `useDecision`.

Acceptance: one functional search field, visible results, accessible day deletion on mouse/keyboard/touch, accurate confirmation, reload persistence, and rejection of stale or foreign-trip mutations.

## 3. Whole-trip Schedule

References: end of PDF page 2 and start of page 3.

- Make Schedule a trip-level view, grouped into Day 1/date, Day 2/date and every remaining day in order.
- Keep Itinerary and My route tied to the selected day. Position/label the view controls so Schedule does not appear to be restricted to the day currently selected.
- Under each day, show saved visit ranges, destination names and expandable Notes. The disclosure applies to the schedule's reading view; editable notes remain visible in the itinerary cards.
- Include flexible-time stops and empty days. Check overlap within each day, not between different days.
- Selecting a schedule stop opens its correct editable day/card and restores focus.
- Preserve the shared Safari Hour, Minute and AM/PM controls. Preserve the approved position-based time-slot behavior when rearranging stops.
- Keep Print and Download consistent with the full saved trip, including saved notes even when their on-screen disclosure is closed. Preserve draft/export guards.

Primary owners: `DaySchedule` extended through a shared trip-level schedule composition, `ItineraryPlanner`, `PrintableItinerary` and the existing schedule helpers. The trip data already includes all days and stops; avoid fetching each day separately.

Acceptance: every saved day appears once with the correct stops, times and notes; empty/flexible/overlap states work; editing and exports agree after reload.

## 4. Category return and mobile navigation

References: PDF pages 3 and 4.

- All [area] categories should return directly to that area's photographic category panel on the homepage map.
- Resolve the destination panel state before showing the returned view. Provide immediate navigation feedback while data/assets load instead of leaving an unresponsive old page visible.
- Keep the correct area, category-page position on phones, sticky-header clearance and browser Back behavior. Preserve the separate exact-card return from a destination guide.
- Make the public phone menu a right-side drawer, retaining the current identity/menu contents, backdrop, close/Escape behavior, focus restoration and reduced-motion support.
- Verify the drawer and fixed Bucketlist/cart do not fight for scroll or overlap controls.

Primary owners: `AreaNavigation`, the homepage map/category state, `BrowsingTrail`, `SiteHeader` and the existing `Modal` drawer variant.

Acceptance: one click returns to the requested category panel without an intermediate wrong state; repeated category/Place/Back journeys work; the phone drawer opens from the right and remains operable with touch and keyboard.

## 5. Profile, membership and feature hooks

References: PDF pages 3-5.

- Remove the circled profile shortcut list: My Bucketlist, My Portfolio and Account settings. Keep the real sections and settings reachable on the page.
- Remove Itinerary Planner from the Settings section header only. Keep the primary navigation/planner entry points elsewhere.
- Explorer profiles should still show ordinary My Bucketlist and My Portfolio preview/empty-state sections, rather than a large lock replacing both. Protected section actions open the feature hook; this visual preview does not grant access to protected saved data or mutations.
- Keep premium collections functional, including existing mobile swipe rails and featured-place behavior.
- On phones, place Your membership and its details immediately above Settings. On desktop, retain the useful membership sidebar without the redundant shortcut list.
- Make the membership page aware of the actual tier. An active Explorer+ member sees their plan/status and available saved expiry details, with useful map/planner/account actions instead of a Get Explorer+ sales prompt. Do not invent renewal or billing-portal capabilities.
- Send signed-in Explorer upgrade/Get Explorer+ actions directly to the existing checkout, with a safe return target. Keep informational Membership navigation available. Guests retain sign-in/registration recovery, and active Explorer+ members are not treated as new buyers.
- Use one shared tier-aware upgrade destination for hooks, comparisons, profile and other upgrade buttons. Navigating to checkout must not create a charge automatically.
- Restyle feature hooks to the compact gold-bordered card in the reference: gold padlock, feature name, short upgrade explanation and gold button, with Back outside the card. No extra content logo.
- Keep destination hooks distinct: authorized photo preview plus membership comparison. Do not replace them with the compact feature card or expose protected destination names/media.

Primary owners: `MemberPage`, `ProfileRail`, `FeatureLock`, `GateUpgrade`, `membershipMarkup`, `MembershipComparison` and the existing checkout/return helpers. Tier must come from the authoritative session, not a browser flag.

Acceptance: guest, Explorer, active Explorer+ and expired membership states each see the appropriate actions; free profile previews lead to the hook; active premium users do not see acquisition prompts; mobile section order matches the brief.

## Execution order and dependencies

| Batch | Work | Depends on |
| --- | --- | --- |
| A | Shared card geometry and reference exploration toolbar; complete result rendering | Existing card/filter owners and the PDF |
| B | Persistent inline search and whole-trip Schedule | Shared card/search primitives; existing full-trip data |
| C | Delete-day transaction, confirmation and day-tab controls | Confirmed date policy, backup, owner/version safeguards |
| D | Category return recovery and right-side phone drawer | Existing map state and return helpers |
| E | Profile sections, membership state, direct checkout routing and compact feature hooks | Authoritative tier and shared upgrade/return routing |
| F | Regression checks, screenshots and staging release | All batches and acceptance checks |

The new PDF supersedes earlier selected-day-only Schedule, search-toggle, Show more, left-drawer and profile-shortcut decisions for these surfaces. Update the relevant design/UX contracts alongside implementation so future work follows the new behavior.

## Verification and release evidence

- Desktop, small laptop, 390px phone and a narrower phone layout. Test long titles, absent pictures and mixed locked/unlocked cards.
- Chromium and WebKit journeys for add/edit times, search, all-day schedule, category returns and menu behavior. Physical Mac Safari remains a client verification step.
- Delete-day tests: empty/occupied day, cancel, stale version, foreign trip, double activation, active-day fallback, date boundaries and the final-day rule. Compare unaffected days/stops and original destination/media records.
- Exercise guest, Explorer, active Explorer+ and expired access paths, including a direct URL and safe upgrade return. Stop before submitting a real payment.
- Exercise loading/retry, no results, saved-state errors, unsaved drafts, Notes disclosure, keyboard focus, touch access and reduced motion.
- Check print/download across multiple days with notes and flexible visits.
- Run appropriate backend/browser tests, typecheck, lint, build and release/secret checks. Capture representative desktop and mobile screenshots for client review.
- Publish the completed implementation to the existing staging release workflow and verify the canonical Vercel alias and hosted journeys. Release evidence is recorded in CLIENT_PLAN_DELIVERY.md and the private verification artifacts.

## Decision status

- Confirmed: delete the selected day and its stops after confirmation.
- Confirmed: later days shift earlier, the start date stays the same, and the end date shortens. At least one day remains.
- Visual interpretation: use the reference transport/Explorer+/sort/reset toolbar in planner exploration, omitting its travel-time control and the current extra Assets disclosure. Destination card travel-time facts remain; the PDF removes the filter, not that factual card metadata.

Saved times, existing trips, destination records, original photos, membership prices and payment-provider configuration are preserved except for an explicitly confirmed deletion of the selected day and its stops.
