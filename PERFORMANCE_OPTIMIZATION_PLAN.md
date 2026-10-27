# Unlock Paradise performance and image plan

Prepared 27 October 2026. Implementation authorized and carried out after planning. See PERFORMANCE_OPTIMIZATION_DELIVERY.md and its private release evidence for completed work and measured limits. Billing and spend-cap settings remain unchanged.

## Recommendation

Keep Supabase for Storage, Auth and the database. Stop using its on-demand image transformation endpoint for website delivery. Serve stored, appropriately sized images through the existing access rules, and generate additional display copies once during upload or a controlled backfill. Preserve the exact original upload privately.

Order: establish the baseline without generating additional transformation usage; remove the runtime transformation dependency using existing variants; preserve future upload originals and generate missing derivatives; then improve caching, page loading and interaction performance. Keep the existing design, focal points, animations, two-second itinerary previews and business flows.

## Evidence from this inspection

| Finding | Evidence | Implication |
| --- | --- | --- |
| The screenshot shows 544 origin images against an included quota of 100 for 22 October–22 November. | Client-provided usage screenshot. This is a screenshot reading, not a fresh billing API measurement. | Stop growing the meter through normal browsing. The existing count will not decrease after a code fix. |
| Supported raster requests with an allowed `width` enable a Supabase `transform` at quality 75. | `src/app/api/media/[id]/route.ts`, `src/lib/image-delivery.ts`. | The shared responsive-image path invokes the metered service for public and private images. |
| Already generated variants can still be transformed again. | The media route resolves `variant` first, then applies `width` transformation. | Existing resized files are not preventing transformation usage; successive lossy encoding can also reduce quality. |
| New-upload variant resolution is coupled to legacy metadata. | The route only adopts a variant when the parent has `original_path`. | Fix resolution before relying on derivatives for future uploads. Preserve legacy fallback separately. |
| There are 3,437 ready media records and 20,124 ready `media_files` records. Only 10 media records have no ready non-archive variant. | Fresh, read-only aggregate queries against the pinned client project. Evidence: ignored `artifacts/performance-plan-oct27/media-inventory.json`. | Reuse the existing thumbnail/medium/large library before generating new sizes. |
| 2,002 media records have an archived source; 1,488 file records are HEIC originals. | Same inventory. | Archive coverage is incomplete. Do not assume deployed Sharp can decode HEIC; use the best existing supported master where necessary and retain HEIC originals. |
| Admin uploads already use centralized Sharp conversion to quality-88 WebP, maximum 4096px without enlargement. The uploaded input is not archived by this path. | `src/lib/storage/images.ts`, `src/app/api/admin/upload/route.ts`. | Extend the existing pipeline; do not add another competing compressor. Current conversion is lossy, not lossless source preservation. |
| The admin endpoint accepts 5 MB files through a function request. | Admin upload route; Vercel documents a 4.5 MB function payload limit. | Large originals should upload directly to private Storage through a narrowly scoped authorization flow. Multipart overhead also matters. |
| Private delivery creates 60-second signed URLs; redirects are private/no-store. | Media route. | Correctly protect private media, but inspect repeated authorization/signing and short-lived URL cache fragmentation. |
| Public destination previews perform DB reads, download a source and run Sharp on each cache miss. | `src/app/api/previews/[id]/route.ts`. | Store approved previews ahead of time instead of repeatedly generating them during browsing. |
| The root layout forces dynamic rendering and loads map/gallery and several legacy styles globally. | `src/app/layout.tsx`. Mapbox JS itself is already dynamically imported. | Measure shared CSS and public-data work. Avoid recommending dynamic imports that are already implemented. |
| Local raster assets total about 62.8 MB across 383 files; 6 exceed 1 MiB. | Read-only filesystem inventory, `artifacts/performance-plan-oct27/local-asset-inventory.json`. | Prioritize assets actually requested on entry pages; repository size is not page download size. |

The Supabase connector denied project SQL access; aggregate inspection used the existing pinned database connection in a read-only transaction. No private row data or credentials are included in this document. No Lighthouse scores, field Web Vitals or measured loading-time improvements are claimed yet.

## 1. Baseline and release guardrails

- Capture the deployed commit, current content counts, association IDs, source paths/checksums, visibility and gallery ordering before implementation.
- Profile homepage/map, area/category listing, free and premium destination pages, membership/checkout, merch/product/cart, profile, itinerary library/editor/exploration and admin media/place/product flows.
- Test phone and desktop, cold and warm cache, slow mobile connection and CPU throttling. Record document TTFB, LCP, CLS, long tasks, image bytes, JS/CSS bytes, request counts, redirects and failed images. Use repeated lab runs and medians; field INP needs real-user evidence.
- Do not deliberately request previously unseen `/storage/v1/render/image/` origins for benchmarking while the quota is exceeded. Record the protected baseline method and any blocked-image limitation. Start with stored data and existing traces; use existing transformed origins only if a true pre-change comparison is needed.
- Record image dimensions, transparency, orientation and focal-point examples for visual comparison. Include waterfalls, mountain summits, cave interiors, product prints and portraits.

Deliverable: reproducible baseline and a prioritized, measured bottleneck list. No speculative rewrite or paid service purchase.

## 2. First release: remove the Supabase transformation dependency

1. Inventory all callers: `ContentImage`, static markup recovery, maps/category photos, destination gates/previews, galleries/thumbnails/lightboxes, merch, profile, admin previews and itinerary cards. Search generated/static data and legacy URLs as well as source code.
2. Change the existing media resolver so `width` selects an already stored ready variant; it must not call Storage with `transform`. Select an adequate source for the actual requested width, preserve aspect ratio/focal points, and never label a smaller file as a larger `srcset` candidate.
3. Reuse current WordPress-size variants based on verified dimensions. Where size metadata is absent, build a manifest once from stored metadata or bounded inspection; do not download every source per page request. Add explicit dimensions only if needed, with a reviewable additive migration.
4. For the 10 records without display variants or other missing sizes, use a validated existing image unchanged as a temporary fallback, or the existing unavailable state if no usable source exists. Do not route recovery back through Supabase transforms or send an archive/HEIC file to ordinary browsers.
5. Fix the new-upload/legacy `original_path` coupling. Keep media IDs, associations, gallery positions, tier rules and legacy recovery compatible.
6. Public previews remain deliberate, identity-safe preview derivatives. Premium galleries, profile images and archival masters remain private. Do not expose originals to obtain a higher cache hit rate.
7. Release behind a delivery feature flag. Retain a previous-compatible stored-file fallback, not a transform fallback. Check every dependent route before optionally disabling the project's Image Transformations setting as a final safeguard.

Acceptance: normal supported routes and recovery paths make zero requests to `/storage/v1/render/image/`; no new use of Storage `transform` options; access-control tests pass; pictures keep their intended crop. Verify provider usage/logs after reporting delay. Other applications, old tabs or old direct URLs can still generate usage until addressed. Keep the spend cap enabled and billing unchanged.

Supabase meters distinct origin images per billing period, not individual requests or each responsive width. Reducing widths and improving caching helps bandwidth/workload but does not by itself eliminate this quota. Historical usage resets with the billing cycle, not with deployment. [Supabase usage documentation](https://supabase.com/docs/guides/platform/manage-your-usage/storage-image-transformations).

## 3. Admin uploads: exact originals plus display derivatives

```text
Admin selects file → authorized direct upload to private quarantine
                  → validate bytes, size, format and pixel limits
                  → preserve exact original + SHA-256 in private archive
                  → generate display variants once with the shared Sharp pipeline
                  → verify stored variants → atomically mark media ready
                  → refresh the owning editor and published content
```

- An original is lossless here only when its bytes and checksum match the uploaded file. Do not resize, auto-rotate or re-encode the archival copy. Orientation/color normalization and privacy-metadata stripping apply to website copies; private originals are staff-only and never browser fallbacks.
- Use staff-checked, short-lived, object-scoped upload authorization with unique immutable paths. Validate the completed object server-side; client MIME/extension claims are insufficient. Use resumable upload when appropriate. This avoids routing large binaries through Vercel's [4.5 MB function payload limit](https://vercel.com/docs/functions/limitations).
- Reuse one server-authoritative Sharp implementation. A durable job record tracks uploaded, processing, ready and failed states. Processing is bounded and retryable; it must not depend on an unawaited task surviving a function response. Use an authenticated job runner with bounded batches on the existing Node deployment where its measured limits fit; backfills run through the same pipeline from a checkpointed CLI. Select another worker host only if measured duration/memory requires it and its operating cost is accepted.
- Keep the original plus a small set of useful sizes. Start with existing 256/384/640/1080/1920 widths and a 192px avatar derivative; generate only widths the source can support. Keep the full supported master for user-requested zoom; add larger delivery copies only when a real screen needs them.
- Photography: trial high-quality WebP around 85–90 and compare difficult samples at their display size before fixing settings. Larger/zoom photos may need different settings. Avoid repeatedly recompressing WebP or generating variants from existing tiny thumbnails.
- Logos, diagrams, text-heavy graphics and transparent artwork: preserve safe SVGs or use true lossless WebP/PNG where appropriate. Quality 100 is not the same setting as lossless encoding; Sharp supports explicit `lossless: true`. [Sharp output options](https://sharp.pixelplumbing.com/api-output/).
- Fully pixel-identical photographic delivery is possible with lossless formats, but does not guarantee smaller files. Recommended default is **byte-exact archival originals and visually faithful, appropriately sized website copies**. Never describe resized/lossy copies as mathematically lossless.
- Preserve animation when supported; otherwise reject with a clear supported-format message instead of flattening animated WebP silently. HEIC/AVIF support is enabled only after codec verification on the actual worker. Retain ICC/orientation behavior and strip GPS from public derivatives.
- Show upload and processing status, cancellation before publication, partial success and retry without duplicate media. Publish references only after required copies exist. Replacing an image creates a new version; it does not overwrite/delete a source.
- Reuse `media`, `media_files`, current private archive and access checks. Add only necessary job/dimension/version fields through explicit migrations and grants; no broad RLS relaxation.

Acceptance: JPEG, PNG, WebP, transparent/animated, oversized, malformed and unsupported files behave deliberately; archived SHA-256 equals input; file MIME matches bytes/extension; failed processing leaves existing published content usable; admin, profile and product upload flows retain authorization and association behavior.

## 4. Existing library: non-destructive optimization

- Reuse current variants immediately; inventory which source is the highest-quality supported master for each media record. An absent original cannot be reconstructed from a compressed JPEG/WebP. Report missing originals for client recovery.
- Pilot 30–50 representative images, including public/private content, archived HEIC with existing JPEG derivatives, product artwork, portrait/landscape and focal points. Compare full-size and displayed crops before backfilling.
- Generate missing/new WebP derivatives into versioned paths, with source checksum + processing-recipe version as an idempotency key. Start concurrency at 2 and adjust from measured memory/load. Record success, failure, bytes before/after and checkpoints.
- Preserve all previous files, IDs and relations. Update the derivative manifest only after objects and checksums are verified. Rollback changes pointers to existing objects; it never deletes uploaded sources.
- Generate approved public cover previews once; invalidate/regenerate when the cover, focal point, publication or visibility changes. Do not serve stale previews after unpublishing.
- Convert local photographs only where actual route usage and measured savings justify it. Keep supported vector/animated assets and retain legacy references until the replacement manifest is verified.

Acceptance: content/association counts unchanged; gallery order unchanged; complete or explicitly reported source coverage; no corrupted/unreferenced published images; measured quality and size report. Estimate added Storage, worker compute and egress from the pilot before the full backfill.

## 5. Faster delivery and page loading

- Use one image-optimization owner per asset. Stored derivatives should be served directly; do not run them through Supabase and then Next/Vercel image optimization again. Keep Next's existing optimization for local originals only where it still adds measurable value.
- Public approved immutable derivatives: stable versioned URLs and long browser/CDN caching. Use new paths for replacements and targeted content/manifest invalidation so admin updates appear without manual cache clearing.
- Private derivatives: authorize every delivery decision. Retain private/no-store policy until any per-session signed-URL reuse and cache lifetime are reviewed against logout, expiry, membership and visibility changes. Never globally share user-specific signed redirects or mark premium responses public. Supabase notes that newly generated signed tokens fragment CDN cache keys and that token expiry and CDN cache lifetime are independent. [Smart CDN documentation](https://supabase.com/docs/guides/storage/cdn/smart-cdn).
- Serve dimensions and correct `sizes`/`srcset` for card, thumbnail, hero, avatar and lightbox roles. Prioritize the actual LCP image only; lazy-load below-fold images and full-resolution gallery content on demand. Reserve image geometry and preserve focal cropping; do not add letterbox bars to avoid doing crop work.
- Keep the requested two-second itinerary crossfade. Preload only the next display-sized image for visible eligible cards, skip unavailable/unloaded frames, pause offscreen/hidden/reduced-motion work and bound image decoding. Do not download every destination photo on page load.
- Measure gallery thumbnail duplication, public preview generation, map/category loading and fallback redirects. A fallback must try an untransformed usable copy at most once and then show the stable unavailable state.

## 6. Application and interaction improvements

- Use the baseline waterfall and production bundle report to prioritize shared CSS/legacy scripts, map initialization, galleries and route-level hydration. Keep Mapbox dynamically imported; defer initialization until near viewport or user demand where it will improve entry loading without making the main map feel unresponsive.
- Reduce global map/gallery/form styles only after cascade and route-by-route visual verification. The root currently uses `force-dynamic`; do not remove it globally or cache personalized HTML. Cache reusable published data separately, with invalidation on admin edits and session-independent keys.
- Deduplicate repeated session/profile and public catalog reads within a request. Inspect actual slow queries and execution plans before adding indexes; preserve ownership/tier checks and bound admin/catalog results.
- Keep the itinerary library paginated and all destination covers available while loading pixels progressively. Optimize expensive metadata queries only when profiling demonstrates the cost.
- Prefer compositor-friendly opacity/transform for existing effects, clean up listeners, avoid layout reads during pointer/scroll loops, and verify drag/time/menu interactions under CPU throttling. Retain reduced motion and the established animations.
- Keep route returns, scroll restoration, form drafts, validation, checkout, membership and Google authentication behavior intact. Performance work should not alter these business flows.

## Release sequence and completion criteria

| Release | Scope | Gate |
| --- | --- | --- |
| A | Baseline, stored-variant resolver and zero-transform fallbacks | Public/free/premium/admin image coverage; zero render endpoint requests; ready-to-rollback feature flag |
| B | Exact original archive, reliable upload jobs and generated variants for new uploads | Original checksum equality; upload/retry/permission tests; no broken published references |
| C | Pilot, approved previews and checkpointed library backfill | Visual comparison, projected storage/compute cost, complete manifest and rollback |
| D | Cache, image priorities, measured bundle/query/interaction work | Before/after route metrics, freshness/access tests, same visual and functional behavior |

Targets are goals, not promises: good Core Web Vitals at the 75th percentile—LCP ≤2.5s, INP ≤200ms and CLS ≤0.1—and improved repeatable lab measurements on representative mobile routes. [Web Vitals definitions](https://web.dev/articles/vitals). Report cold/warm conditions, device/throttling, sample counts and lab-versus-field limitations. Do not claim a 90+ Lighthouse result before measuring it.

For each release: relevant unit/integration tests, lint/types/build, desktop/phone Chromium and WebKit checks, controlled upload verification, guest/free/premium/staff access checks, crop/quality comparison, cold/warm network inspection and content-preservation audit. Stage first, publish only after acceptance, keep the prior deployment and derivative mapping available for rollback.

Success means no website dependency on Supabase's transformation meter, byte-exact originals for future admin uploads, smaller appropriate display downloads with approved quality, faster measured loading/interactions, immediate correct image replacement and preserved content/access behavior. Storage, egress and worker costs still exist; record them rather than treating removal of one meter as free infrastructure.
