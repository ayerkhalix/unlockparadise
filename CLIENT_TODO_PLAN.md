# Client todo implementation plan

Prepared 24 October 2026 from the seven-page `todo list (1).pdf`, including its screenshots, and a read-only review of the current application.

Status: A–F and local verification G1–G5 are complete. G6 remains open for staging deployment and post-deploy checks. Checked items record the executed scope described below, not comprehensive browser or assistive-technology coverage. See [CLIENT_TODO_DELIVERY.md](CLIENT_TODO_DELIVERY.md) for the demo checklist, evidence and remaining limits.

## Working interpretations

- **Featured names are the exception.** The homepage's editorial Featured destinations can show their names and photos to guests and Explorer accounts. Other Explorer+ previews show photos but keep their names hidden. This updates the earlier rule that hid every premium name. Use the explicit editorial featured flag, not every personalized recommendation, to define the exception.
- **Photos become previews; premium details stay protected.** Give every published premium destination an approved public photo preview. Keep its full guide, coordinates, access points, and other protected details behind Explorer+. Do not make the entire private storage bucket public to achieve this.
- **Explorer Bucketlist buttons advertise the feature.** Show the action on cards, but open the relevant upgrade hook when the viewer lacks Explorer+. This request does not grant free Bucketlist, Portfolio, or Planner access.
- **Portfolio remains.** Remove the Add to Portfolio action from destination pages for now; retain existing portfolio records and screens. Update empty-state instructions so they do not point to the removed action.
- **The map remains.** The homepage map and the planner's My route map stay. Only the Explore destinations/add-destination discovery flow changes from a mini map to a dedicated browsing page.
- **Instagram is a layout reference.** Use its compact avatar/name/action arrangement, without adding followers, following, posts, social sharing, or unrelated social features.
- **Merch library means an overview section.** The screenshot places this beside the existing Place library in Admin Studio. Reuse the existing Merchandise editor and catalogue rather than inventing another product management system.

## Delivery order

| Batch | Priority             | Scope                                                 | Depends on                                | Review result                                               |
| ----- | -------------------- | ----------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| 1     | High                 | Public previews, membership hooks, access routing     | Agreed interpretations above              | Guest / Explorer / Explorer+ comparison                     |
| 2     | High                 | Navigation, mobile menu, cookies, floating controls   | Batch 1 return-navigation contract        | Mobile navigation and map screenshots                       |
| 3     | Medium               | Discovery result and profile editing                  | Existing account and preference APIs      | First-sign-in journey and profile edit walkthrough          |
| 4     | Medium               | Destination actions and Getting there                 | Batch 1 premium boundary                  | Destination page with access points                         |
| 5     | High, largest change | Dedicated itinerary browsing and branded exports      | Batches 1-2; batch 4 shared cards/actions | Add destinations, return to trip, route, download and print |
| 6     | Medium               | Admin content authoring, merch preview, theme control | Batch 4 display structure                 | Edit existing content without HTML                          |
| 7     | Required             | Cross-account verification and staging release        | All batches                               | Screenshots and a checked client demo list                  |

## Batch 1 - Previews, membership and hooks

Source: PDF pages 1-2 and 4-5.

- [x] A1. Show photo previews for published Explorer+ destinations in guest and Explorer browsing. Homepage editorial Featured cards also show the real title. Other premium cards retain a generic label and opaque destination URL.
- [x] A2. Add a destination-focused upgrade hook after the Featured section. Its copy should promote discovering premium places rather than describe Bucketlist, Portfolio or Planner features.
- [x] A3. Keep destination hooks and feature hooks distinct. Use the compact branded padlock layout in the reference, with copy appropriate to the required tier and the selected feature/place. Do not repeat the full plan-comparison table on every locked destination.
- [x] A4. Send Upgrade to Explorer+ to `/membership/`, carrying a safe return destination. Keep account creation/sign-in where needed later in the membership/checkout journey.
- [x] A5. Show guests the relevant hook when they request a member destination or feature, rather than immediately sending them to sign-in. A free-account hook can offer Join free; an Explorer+ hook offers membership information.
- [x] A6. Replace Keep exploring Palawan with Back. Restore the previous internal page and useful context, with a homepage-map fallback for a direct visit. Prevent external redirects and navigation loops.
- [x] A7. Update membership inclusions to match the shipped product, including planning, scheduling, route viewing and exports. Use actual plan pricing and savings; do not introduce unsupported benefits.
- [x] A8. Expose Bucketlist controls on Explorer destination cards and route blocked save/add-to-itinerary actions to the matching feature hook. Do not perform a save before membership allows it.

Implementation owners: `destination-gate.tsx`, `feature-lock.tsx`, destination/card rendering, member route handling, membership content, public catalogue projections and media delivery policies.

Completion checks:

- Guests and Explorer accounts see the approved preview photos; Explorer+ still sees the complete permitted destination.
- Outside the Featured exception, protected names stay absent from API responses, rendered HTML, metadata, alt text, filenames, readable links and search attributes. Search must not indirectly reveal an otherwise hidden name.
- Preview-image delivery is explicit; private originals, unpublished destinations, detailed maps and coordinates remain protected. Review preview images that contain identifying captions or embedded location metadata.
- Featured-title visibility follows the same rule in both the data projection and UI. Retain opaque links so removing a destination from Featured does not require replacing published links.
- Each blocked action opens the correct hook; Back and membership navigation preserve the user's task.

## Batch 2 - Mobile layout and navigation

Source: PDF pages 4-5 and 7.

- [x] B1. Move the mobile navigation drawer to the left and animate it smoothly into view. It should occupy part of the viewport with a backdrop, close control and reduced-motion support.
- [x] B2. Inside the mobile menu, replace the nested profile icon/disclosure with its account links directly. Keep signed-in and guest choices appropriate to the account state. Preserve the desktop account control.
- [x] B3. Fix the area/category return link that overlaps the logo. Reserve space beneath the sticky header so the return link and category tabs remain readable and clickable.
- [x] B4. Replace the oversized mobile cookie notice/preferences presentation with a compact dialog. Keep Essential only, Allow analytics and Manage preferences clear, and retain existing saved choices and consent behavior.
- [x] B5. Resolve the floating Bucketlist control's collision with map zoom controls. Use shared clearance rules for docks, cookie dialogs, map controls and safe areas, rather than a page-specific offset that breaks elsewhere.
- [x] B6. Remove the extra clickable category-icon strip pictured on PDF page 4. Keep the normal area/category navigation used for browsing and by the new planner discovery page.

Implementation owners: `site-header.tsx`, shared modal/drawer styles, category navigation, `analytics-preferences.tsx`, floating dock and map-control placement.

Completion checks: no covered controls, horizontal page overflow or inaccessible return links at 375, 390, 430, 768 and 1440 pixels. Verify touch, keyboard focus, Escape, backdrop close, focus restoration and reduced motion.

## Batch 3 - Discovery result and profile

Source: PDF pages 3-4.

- [x] C1. Remove the public traveler-badge visibility question from registration/first-sign-in discovery. Keep that choice in Account settings, default new accounts to private, and preserve existing users' saved choices.
- [x] C2. Simplify the discovery result to one traveler title, its explanation, the playful-reflection line and Explore my picks. Remove the repeated badge/interest chips, Based on your selected interests explanation and competing secondary action.
- [x] C3. Rework the profile header into a compact Instagram-inspired layout: avatar, display name, traveler label/likes, relevant existing travel counts and Edit profile. Keep Explorer blue and Explorer+ gold membership labels overlapping the avatar.
- [x] C4. Make the avatar non-clickable on the profile. Move avatar/photo changes and existing editable profile/preference fields into an Edit profile dialog with clearly grouped sections. Remove the standalone Edit Travel Preferences link without removing the ability to change preferences.
- [x] C5. Keep badge-sharing privacy in Account settings. Preserve the View map shortcut and existing Bucketlist/Portfolio navigation, arranged to suit the revised profile.

Implementation owners: `traveler-discovery.tsx`, `member-page.tsx`, profile-photo/preferences components and the existing form/modal system.

Completion checks: profile edits persist; errors retain input; closing dirty edits asks before discarding; uploads use existing validation; new discovery does not accidentally publish badges or overwrite a returning user's privacy choice. Do not put membership, role changes or password operations into an ordinary profile save.

## Batch 4 - Destination pages and Getting there

Source: PDF pages 3 and 5-6.

- [x] D1. Remove Add to Portfolio from destination pages for now, preserving existing data and correcting any nearby instructions that depend on that button.
- [x] D2. Hide the always-visible access/drop-off pin label. Reveal the name on hover, keyboard focus or touch selection; keep an accessible name for the marker.
- [x] D3. Remove the vague standalone Open in Maps button below the map. Organize Getting there into **Jump-off / access point** and **Destination** sections, each with its own contextual Open in Maps action.
- [x] D4. Keep raw coordinates out of the jump-off section. Put destination coordinates in the Destination section, preserving a useful copy action there. Every Maps link must use the corresponding point, not the same coordinates for both sections.

Implementation owners: `destination-detail.tsx`, `destination-location.tsx`, `access-markers.ts` and shared map presentation.

Completion checks: handle several access points, no access points, missing optional coordinates, a failed map load and touch devices without hover. A destination without an access point must not show an invented jump-off location.

## Batch 5 - Itinerary discovery and branded exports

Source: PDF page 6.

- [x] E1. Rename Search destination to Add destination where it is the planner's action label, including My route. Keep clear search field labels within the actual finder.
- [x] E2. Make Explore destinations/options open a dedicated planner browsing page based on the existing area/category catalogue design. This replaces the mini discovery map, not My route or the homepage map.
- [x] E3. Carry the selected owned trip and day into that page. Include area/category navigation, existing filters, destination cards, an Add to itinerary action and a prominent View final itinerary return link beside the category navigation.
- [x] E4. In this planner-only browsing context, remove Bucketlist buttons and its floating dock. Keep normal catalogue actions on ordinary destination browsing pages.
- [x] E5. Preserve selected category/filter context after adding a place, mark confirmed additions as added and retain the existing time/duration picker. Returning to the plan restores the same trip/day. Missing, deleted or unavailable plans get a useful recovery screen.
- [x] E6. Retain the existing Final itinerary, My route, time editing, Notes, stop menu and hold-to-reorder behavior. Guard unsaved edits before leaving the planner for the new page.
- [x] E7. Add an Unlock Paradise logo/wordmark and polished document header/footer to downloaded itineraries and print/PDF output. Include the trip title, dates, daily stops, times and notes; check page breaks and long entries.

Implementation owners: `itinerary-planner.tsx`, `place-search.tsx`, a new planner browsing route, existing catalogue/card owners, planning APIs and `itinerary-schedule.tsx`.

Completion checks:

- End-to-end: choose a day -> explore a category -> add a place and time -> continue browsing -> view final itinerary -> verify My route.
- Use the existing owner/version-checked mutation API, membership checks and server-confirmed updates. Handle stale versions, failed saves and double clicks without false Added states or duplicate stops.
- Download remains the existing standalone HTML export; Print itinerary supports the browser's Save as PDF. Branding must work in both, including an offline downloaded document, without exposing private media URLs or adding a new server PDF service unnecessarily.

## Batch 6 - Admin authoring and overview

Source: PDF pages 6-7.

- [x] F1. Replace the HTML-first Description input with a visual editor for normal typing, paragraphs, headings, bold text, lists and links. Preserve server sanitization and existing supported content when opening/saving old records.
- [x] F2. Keep the Getting there by road and boat timeline the client liked. Provide plain fields for starting point, road duration, departure/jump-off point, boat duration, destination and notes; render the timeline from these fields. Reuse existing structured fields where available and only extend the schema for missing information.
- [x] F3. Add a Merchandise library preview to the Admin overview using real product photos, names and collection information. Open a product in the existing editor and provide an Open library link. Include loading, empty, unavailable-image and retry states.
- [x] F4. Move the theme switcher to a compact sun/moon icon at the upper right of the admin content header, with an accessible label and current-state tooltip. Retain the user's selected theme across admin screens.

Implementation owners: `place-editor.tsx`, description editing, `travel-guide.tsx`, `admin/overview.tsx`, `admin-theme.tsx` and existing admin APIs.

Completion checks: a nontechnical editor can reproduce the reference formatting and route timeline without entering HTML. Existing content must not be silently flattened or rewritten. Confirm dirty-state protection, stale-save handling, light/dark themes and staff permissions.

## Batch 7 - Verification and staged delivery

- [x] G1. Implement and review one batch at a time, with focused desktop/mobile screenshots and short completion notes.
- [x] G2. For any data/policy change, inspect the live schema first, back up affected records and prepare a reversible migration. Do not apply permissive global storage or destination-access policies as a shortcut.
- [x] G3. Test guest, Explorer and Explorer+ journeys, plus admin/editor restrictions. Include direct bookmarked links, browser refresh/back, expired sessions, inaccessible plans and the non-featured premium-name checks.
- [x] G4. Test the revised mobile menu, cookie dialog, category bar, maps/dock clearance, profile editor and planner browser together at phone, tablet and desktop widths. Check keyboard operation, reduced motion and focused accessibility coverage.
- [x] G5. Run checks appropriate to each change, then the final typecheck, lint, database/access tests, affected Playwright journeys, production build and release-secret scan. Document any untested external delivery rather than claiming it passed.
- [ ] G6. Deploy the completed batches to `unlockparadise-staging.vercel.app`, verify the live journeys and provide a final screenshot set and client demo checklist. Keep the new plan/status document current as work completes.

### Verification progress — 24 October 2026

Typecheck, full lint, production build, release-secret/browser-bundle scan and all 119 backend tests pass. All 18 unique client-todo desktop/mobile journeys now pass: 14 in the expanded run and eight focused reruns cover the corrected profile/admin cases and strengthened planner/Back checks. The final two planner reruns also pass after the measured map-feedback clearance and print-heading changes. Earlier failures were corrected and are not counted as successful execution.

Browser evidence covers guest/Explorer/Explorer+ gates, opaque previews, actual name persistence/restoration, scoped errors and pending locks, stale-preference reload, timed Day 2 additions and cleanup, branded downloads, route retry hit-testing, actual admin formatting/journey persistence and cleanup, collection metadata, distinct Maps coordinates and simplified discovery privacy. Additional 375/430/768px checks cover profile reachability, area-header clearance, filter-preserving Back, menu focus restoration and reduced motion; primary captures cover 390/1440px. Axe checks cover the revised profile and planner.

The finish review inspected all 25 required PNGs and identified five runtime gaps plus documentation drift. Those fixes are applied. A subsequent scoring pass identified the taller retry notice overlapping the route list on desktop; the shared feedback now measures its height and the list clears it. The final two route cases assert their geometry and retry hit targets. Review evidence and recaptures remain under artifacts/client-todo.

Both the actual browser print/PDF and downloaded HTML show the official embedded mark, saved days and times without site chrome. A nine-page synthetic long-entry export was visually sampled; its last stop/footer are present, day headings stay with the first stop, and the offline file makes no external request. Native printer drivers and every possible note length are not exhaustively covered.

The hosted journey audit confirms RLS, safe function search paths, no anonymous write access, no browser execution of the prior save function, 385 retained destination details and no invalid starting points. The schema/function snapshot predates the additive migration. Rolling application code back can leave this compatible column in place to preserve authored data. Hosted Supabase advisor access was denied; no fresh advisor clearance is claimed. Automated map captures exercise failure/retry because tile requests were blocked. Staging delivery and successful live map loading remain pending.

## Scope notes

- This plan covers the PDF. Google OAuth setup, business SMTP setup and merchandise payment/fulfillment setup remain separate pending work from earlier conversations; these UI changes do not complete them.
- No new social profile features, free premium entitlements, live payment changes or deletion of portfolio/trip records are implied.
- Preserve the established navy, teal and gold styling and compact sizing. Apply the project's existing design/UX rules during implementation and update those documents where the new client direction supersedes older behavior.
- Before changing application code, read the relevant installed Next.js guide as required by AGENTS.md.
