---
version: 1
slug: "src-components-itinerary-planner-tsx"
primary_target: "src/components/itinerary-planner.tsx"
related_targets: ["src/components/planner-stop-actions.tsx", "src/components/place-search.tsx", "src/components/planner-browser.tsx", "src/app/itineraries/explore/page.tsx", "src/app/phase2.css", "src/app/client-todo.css", "src/components/itinerary-schedule.tsx"]
---

# Client itinerary refinement

## Scope and mode
Operate. Preserve the current public palette, type and saved itinerary behavior. The client's two supplied references pin the compact destination cards, upper-right three-line controls, right-aligned times, Notes trigger, selected-day Final itinerary / My route choices and Add destination's two entry points. This is a refinement of the existing interface, not a replacement visual world.

## Contract
One day is selected at a time. Its timeline and ordered destination cards share the Final itinerary view; My route contains that day's saved stops. Add destination retains inline name search; Explore options opens `/itineraries/explore/` with the owned trip/day. This supersedes the miniature inline discovery map. The dedicated browser has category tabs, photographic header/cards, native filters and View final itinerary, with no Bucketlist actions or dock. Query state preserves its filters and trip/day; confirmed server additions become Added to itinerary. Keep timing forms and note drafts, native day selection, versioned mutations, membership/ownership guards and reload recovery. Leaving the planner protects unsaved work. Hold the menu handle to move a card; explicit Move up/down actions remain available to keyboard and touch users. Download trip is self-contained HTML with the embedded official mark, branded header/footer and saved trip content; Print retains browser PDF support. No new server PDF service or public sharing is introduced.

## Verification
Earlier plan/menu/route evidence remains under artifacts/planner-client-update. The client PDF packet adds desktop/phone browser, confirmed-added, plan and route captures under artifacts/client-todo, indexed in screenshots.json. The initial PDF browser suite passed before the five finish-review fixes; final checks are tracked in CLIENT_TODO_DELIVERY.md. Retain pointer hold/drop/cancel, keyboard disclosure/Escape and move actions, touch, day changes, notes/dirty guards, version/failure recovery and export content coverage. Map failure/retry is captured because automated real tiles were blocked; successful live tiles and long print pagination remain release checks. Shared tokens/primitives remain authoritative.
