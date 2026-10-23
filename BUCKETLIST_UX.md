# Bucketlist UX

The existing `member_places.saved_at` is the source of truth. Phase 2 adds a global count button, an accessible drawer and `/bucketlist/`, plus `/visited/` over the existing visited timestamp. It does not create another persistence layer or alter Explorer+ save eligibility.

Save controls say Add to Bucketlist / Remove from Bucketlist and Mark as Visited / Remove from Visited Places. The portfolio star is accurately named Set as account featured place: its existing operation sets `profiles.featured_place_id` and does not add a portfolio entry. The portfolio still reflects visited Places.

During a write, all matching Place controls are disabled. Server confirmation updates their state, triggers the brief save treatment, refreshes member pages and emits `upd:member-places` so the global count/drawer refreshes. Failure retains the prior state and shows a visible notice. Focus/tab return revalidates the collection. Counts never claim a failed optimistic save.

The drawer uses the shared modal owner with Escape, focus isolation, scroll lock and trigger restoration. It offers full-page management, discovery and itinerary planning. Guests see sign-in guidance; Explorer users see the real Explorer+ boundary. An inaccessible saved record shows Place unavailable, preserving removal without revealing protected content.

The full page supports local search, area and category filters. Cards expose View Place, Add to Itinerary and remove/visited actions. Loading, empty, no-results and failed-load states have explicit text and recovery. Add to Itinerary uses the same trip/day picker as destination cards, details and recommendations.

The floating button respects safe areas and hides during active form focus and open dialogs/galleries. Auth, checkout, merch and admin surfaces use their own primary task navigation. This prevents the count control from obscuring a mobile submit action.

Browser verification covers labels/tooltips, focus restoration, real save/remove persistence, filtering, reload, synthetic failure feedback and the independent itinerary store. See PHASE_2_TEST_RESULTS.md for the actual results.
