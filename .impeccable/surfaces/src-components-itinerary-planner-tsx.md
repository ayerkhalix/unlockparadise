---
version: 1
slug: "src-components-itinerary-planner-tsx"
primary_target: "src/components/itinerary-planner.tsx"
related_targets: ["src/components/planner-stop-actions.tsx", "src/components/place-search.tsx", "src/components/planner-browser.tsx", "src/app/itineraries/explore/page.tsx", "src/app/phase2.css", "src/app/client-todo.css", "src/components/itinerary-schedule.tsx", "src/components/itinerary-library.tsx", "src/components/itineraries.tsx"]
---

# Client itinerary refinement

## Scope and mode
Operate. Preserve the current public palette, type and saved itinerary behavior. The client's two supplied references pin the compact destination cards, upper-right three-line controls, right-aligned times, Notes trigger, selected-day Final itinerary / My route choices and Add destination's two entry points. This is a refinement of the existing interface, not a replacement visual world.

## Current contract
One selected day has Itinerary, Schedule and My route views. Schedule includes timed and flexible stops and an explicit empty state. Photo cards retain three-line reorder/day controls, right-aligned time and always-visible notes with a small icon. The shared Add destination card is below every view. Search destination is inline; Explore options uses the owned trip/day/area, white Places cards, original transport/assets/Explorer+ facets and name/date/rating sorting, with no All destinations tab or search/travel-time filters. Both contexts include canonical Bucketlist controls. Return preserves the exact browse URL, shown count and click position; category back reopens the area on the homepage map. Reordering assigns the new position’s saved time slot atomically and keeps destination notes. Cross-day moves retain visit time. Preserve draft guards, server ownership/premium/version/area validation, reload/failure/retry, Undo, exports and accessible hold/keyboard alternatives.

## Verification
Earlier plan/menu/route evidence remains under artifacts/planner-client-update. The client PDF packet adds desktop/phone browser, confirmed-added, plan and route captures under artifacts/client-todo, indexed in screenshots.json. The initial PDF browser suite passed before the five finish-review fixes; final checks are tracked in CLIENT_TODO_DELIVERY.md. Retain pointer hold/drop/cancel, keyboard disclosure/Escape and move actions, touch, day changes, notes/dirty guards, version/failure recovery and export content coverage. Map failure/retry is captured because automated real tiles were blocked; successful live tiles and long print pagination remain release checks. Shared tokens/primitives remain authoritative.


## Superseding client refinements — 25 October 2026

Photo stop cards precede Daily timeline. New trips require exactly one area; existing trips without one keep their saved content and choose an area before adding. The area is enforced in owned catalog reads and versioned server mutations. Inline search omits area/category filters. Explore destinations includes native day selectors in its toolbar and add dialog, and category hover/focus preserves contrast. My route omits Open main map; Route stops is 8px inside the upper-left edge below measured map notices. Responsive image delivery retains access checks and original assets. Current evidence and release status are tracked in CLIENT_REFINEMENTS_DELIVERY.md.


## Shared Places cards — 25 October 2026

Explore destinations reuses the normal Places card anatomy: rounded 4:3 photograph, white detail panel, dark destination title, travel-time value and teal transport icons. The itinerary action overlays the photo outside the destination link. The browser retains its area and day selection, membership access, versioned add flow and confirmed Added state. Phone cards use one full-width column like regular Places. No Bucketlist control or premium lock is introduced into this authorized planning context.
## Approved compact browsing and recovery — 25 October 2026

Preserve the white Places cards and homepage map CTA. Phone secondary filters move behind Filters while search/categories stay directly available; desktop keeps its row. Static skeleton cards reserve loading geometry. Beside the trip title, distinguish saving, confirmed saved, draft and error; failed saves retain edits and offer retry, while conflicts require reload. Trip options owns labeled Delete trip and its existing confirmation. Shared Undo restores removed stops transactionally with notes, time and position. Verify desktop/phone, failure/retry, keyboard disclosure/Escape, exact restoration and no horizontal overflow. Evidence is in UX_POLISH_DELIVERY.md and artifacts/ux-polish.

## Superseding planner batch — 25 October 2026
The Current contract above supersedes historical Final itinerary/Daily timeline/Notes disclosure and no-Bucketlist descriptions below. Evidence is indexed in PLANNER_REFINEMENT_DELIVERY.md and artifacts/planner-refinement.

## Safari time control — 26 October 2026

Use the shared StopTimeFields native Hour/Minute/AM-PM selectors in every add/edit entry point. Keep complete HH:mm state, optional flexible visits, all minutes and same-day range validation. Match the current navy/teal fields, 16px text, visible focus, 44px controls and responsive grouping. Regression coverage is tests/safari-time.spec.ts in Chromium and the opt-in playwright.webkit.config.ts. WebKit on Windows verifies the engine; it does not constitute a physical Mac Safari test.


26 October client plan: operate within the existing notebook/map identity. One persistent inline name search, whole-trip Schedule with saved Notes disclosures, reference exploration controls and confirmed atomic day deletion supersede the previous selected-day/toggle/disclosure composition. Preserve Safari native time selectors, slot-based reorder, retries, drafts and ownership. See CLIENT_PLAN_2026_10_26.md and UX-CONTRACT.md.

## Itinerary library — 27 October 2026

The approved library is the generic planner entry point. Related owners: src/components/itinerary-library.tsx, src/components/itineraries.tsx, src/lib/itinerary-library.ts, src/lib/repositories/itinerary-library.ts and the namespaced library rules in client-todo.css. Reuse the white Places card anatomy and existing public type, palette and native form primitives. Show actual trip identity, area, dates, day/destination counts and proportional cover images. Search/area/sort/page are URL-owned; loading, no trips, no matches and failed loading are separate states. The selected owned trip keeps its existing editor and direct link. My itineraries uses the existing discard decision and shared source-card restoration; Explore options propagates the safe library target. Duplicate/pinned trips remain later work. Evidence is recorded in ITINERARY_LIBRARY_DELIVERY.md.

27 October photo polish: the library preview now uses ItineraryLibraryCard's bounded crossfade of all unique destination covers, with manual pause, next-photo preloading and the shared visibility/reduced-motion lifecycle. Preserve owner-only metadata and media access. Planner search reserves actual icon space and stacks its two choices on phones. Profile divider spacing and its Account settings shortcut are explicit refinements. Profile PasswordField owns React markup; SiteBehavior only enhances static inputs. Evidence: ITINERARY_PHOTO_POLISH_DELIVERY.md and tests/itinerary-photo-polish.spec.ts.
