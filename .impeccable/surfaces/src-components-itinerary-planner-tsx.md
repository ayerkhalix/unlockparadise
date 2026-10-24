---
version: 1
slug: "src-components-itinerary-planner-tsx"
primary_target: "src/components/itinerary-planner.tsx"
related_targets: ["src/components/planner-stop-actions.tsx", "src/components/place-search.tsx", "src/app/phase2.css"]
---

# Client itinerary refinement

## Scope and mode
Operate. Preserve the current public palette, type and saved itinerary behavior. The client's two supplied references pin the compact destination cards, upper-right three-line controls, right-aligned times, Notes trigger, selected-day Final itinerary / My route choices and Add destination's two entry points. This is a refinement of the existing interface, not a replacement visual world.

## Contract
One day is selected at a time. Its timeline and ordered destination cards share the Final itinerary view; My route contains that day's saved stops. Search destination reveals existing filters/results and Explore options opens existing inline map discovery. Keep timing forms and note drafts, native day selection, versioned mutations, membership/ownership guards and recovery. Hold the menu handle to move a card; explicit Move up/down actions remain available to keyboard and touch users. No fabricated data or server export is introduced. Download trip is an offline HTML copy of authorized text already loaded in the browser; Print retains browser PDF support.

## Verification
Capture 1440px/390px plan, open menu, route and recovery states under artifacts/planner-client-update. Verify pointer hold/drop/cancel, keyboard disclosure/Escape and move actions, actual touch input, moving between days, note persistence and dirty guards, export content, map/search entry and failed saves. Shared tokens/primitives remain authoritative; no new palette or typography tokens.
