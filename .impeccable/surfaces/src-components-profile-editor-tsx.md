---
version: 1
slug: "src-components-profile-editor-tsx"
primary_target: "src/components/profile-editor.tsx"
related_targets: ["src/components/member-page.tsx", "src/components/profile-photo.tsx", "src/components/traveler-discovery.tsx", "src/app/client-todo.css"]
---

# Compact traveler profile

## Scope and mode

Operate. The approved client PDF pins a compact avatar/name/action arrangement in the existing Palawan palette and type. It adds no social metrics or features. The static circular avatar carries the overlapping Explorer blue or Explorer+ gold label; name, traveler title and actual Likes remain beside it. Edit profile and View map stay direct; phone actions follow on their own row. The stats row shows only Bucketlisted and In Portfolio in two equal columns. Saved collections and Account settings retain their existing permissions. Photo editing offers upload/replacement without a Remove photo action.

## Interaction contract

Edit profile uses the canonical scrolling Modal, grouped into Display name, Profile photo and Travel preferences. Separate confirmed saves share one synchronous mutation lock, including photo upload. Conflicting actions and close remain guarded while pending; dirty close/unload protection uses existing owners. Failed name/preferences saves retain drafts beside scoped errors. Reload saved preferences explicitly confirms discarding that draft before loading current values/version. Photo validation remains the existing decoder/type/size path. Badge sharing stays in Account settings, never this form; onboarding omits the sharing question and preserves existing consent. Discovery results use one traveler title/explanation, playful-reflection copy and Explore my picks.

## Evidence and limits

Desktop/390px profile and editor captures are indexed in artifacts/client-todo/screenshots.json; lower-dialog captures at 375/430/768px supplement them. The finish reviewer identified the shared-lock and stale-preference recovery fixes, now present in the sampled source. Final test/release status belongs to CLIENT_TODO_DELIVERY.md. Existing navy/teal/gold, Outfit/Open Sans and scoped traveler lettering remain authoritative.

## Current mobile profile and navigation — 25 October 2026
Preserve the compact identity header, account settings and membership colors. Show the chosen featured place as a visible photo with its selected star. Account Bucketlist/Portfolio collections use native horizontal snap on phones with keyboard and previous/next alternatives. The left menu leads with account photo/name, omits Bucketlist, and places My Portfolio then Log out after Itinerary Planner. Shared dialog focus/Escape/backdrop behavior stays authoritative.
