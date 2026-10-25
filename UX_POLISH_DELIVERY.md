# UX polish and client photo corrections — 25 October 2026

## Scope

Approved polish items 2–8: compact phone destination browsing; trip save/draft/error feedback and retry; labeled Delete trip in Trip options; Undo for itinerary, Bucketlist and cart removals; reserved static destination skeletons; compact phone merchandise introduction and ordering-availability copy; persisted admin photo focal points and previews. Item 1 remains excluded: the main homepage Start exploring/map CTA is unchanged.

The later client correction restores the six homepage category icons as passive hover/focus information, distinguishes photographic destination hooks from padlock feature hooks, removes redundant hook logos, fills missing category photos, preserves featured-photo composition and adds resized-image recovery for React and retained HTML.

## Data and access

Migration `20261024171213_ui_recovery_and_photo_focal_points.sql` was backed up and applied transactionally on pinned client staging. It adds bounded crop metadata and extends the owned/versioned itinerary transaction with restore. Existing role/MFA, RLS, destination-area, publication, duplicate, capacity and timing checks remain. Older clients retain existing crops on retained photo associations. Original photo objects are never rewritten or deleted.

The post-migration audit retained 2,930 photo associations, 15 trips and 7 products. A subsequent direct audit confirmed existing product images are unchanged and removed only two exact, unreferenced synthetic crop fixtures from an interrupted test. New tests archive/delete only their own synthetic Place and remove only their own temporary trip/Bucketlist membership.

Destination hooks use the existing bounded byte-only cover preview. Restricted names, original storage paths, coordinates and guides stay protected. Missing map images fall back to the already-public built-in category thumbnails; no storage policy is widened. Merchandise ordering remains closed, and no real payment, email or provider setting is activated.

## Verification

The image investigation reproduced a 384×2560 river response from a 1920×2560 original. Explicit Storage `resize: contain` returns 384×512, preserving the original 3:4 ratio; the checked response fell from 276,464 to 61,163 bytes. The shared image URL includes the new resize mode to avoid reusing cached redirects from the old crop behavior. The same mode applies after private authorization/signing. Browser checks assert the actual river and island aspect ratios, all eight loaded category photos, and recovery from deliberately failed resized requests. Fallback area choices open category browsing even when WebGL/tiles fail.

Backend tests pass 124/124. The current desktop/phone matrix covers 32 unique client-todo and UX polish scenarios. Its broad run passed 31 and identified a shared mobile tooltip landmark issue; that issue was repaired, and all four focused profile/save/Undo checks then passed, including a failed Undo followed by Retry Undo. These focused checks also cover both viewport sizes. Build, lint, types, formatting, design lint and release/secret checks are recorded under ignored `artifacts/ux-polish/`. The historical full browser catalog contains earlier superseded layouts; the current client-todo and UX polish suites are the relevant runtime release matrix.

The final tooltip belongs to a named contextual-help region outside dialogs, avoiding both landmark errors and clipping inside a transformed header. Undo failure keeps its own Retry Undo action; an ordinary failed save keeps Retry save. Version conflicts retain Reload saved itinerary. The two recovery controls cannot accidentally replay the same removed stop twice.

The premium static audit retains eight existing delegated-action/Swiper findings; runtime behavior is verified separately. The Supabase advisor connector remains denied, so no fresh advisor clearance is claimed. Design lint has zero errors; remaining warnings describe legacy token mapping and translucent-background analysis.

## Release

Release target: [unlockparadise-staging.vercel.app](https://unlockparadise-staging.vercel.app/), from `main` in `ayerkhalix/unlockparadise`, with the working source also retained on `codex/staging-release`. Hosted acceptance runs against the canonical alias; deployment/alias output and `browser-hosted.log` remain in ignored `artifacts/ux-polish/`. This release does not target a live-payment environment.
