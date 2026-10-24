# Client refinements — 25 October 2026

The planner now requires one area per new trip, scopes destination choices to it, and lets the owner select the target day in Explore destinations and its add dialog. Category hover/focus retains readable contrast. Inline Add destination is name search only. My route omits Open main map and places Route stops at the upper-left corner, below any measured loading/retry notice.

Earlier requested cleanup is included: two equal profile statistics (Bucketlisted and In Portfolio), photo upload/replacement without Remove photo, compact Getting there Maps rows without coordinate text, and photo stop cards before Daily timeline. The first-visit choices say Accept cookies / No thanks and preserve the same consent behavior. The About shoreline image crops the spare sky near the mountain and fades into the existing background.

Responsive images now cover the public fragments, gallery, map/category cards, planning/profile pictures, storefront/cart and admin thumbnails. Public local raster files use Next's image cache; authenticated media uses an allowlisted signed Storage transform only after the existing session/RLS lookup. Below-fold photos load lazily, high-priority pictures eagerly, and full-size originals remain intact. Unknown remote sources and vector files are left unchanged. No bulk image deletion or destructive rewrite occurred.

## Verified locally

- All 121 backend tests pass, including atomic area enforcement, stale/foreign-owner rejection, incompatible area changes, legacy-trip preservation and image-routing boundaries.
- All 22 unique scoped browser journeys pass at 1440px and 390px. They cover required area selection, day targeting, area-filter tampering, saved stop times, photo-list/timeline order, real loaded route-map geometry, map failure/retry clearance, profile safeguards, directions, cookies, admin regression, branded exports and optimized About/storefront pictures. Extra viewport checks remain at 375/430/768px. The initial two new test failures were corrected test expectations/selectors, not counted as passes.
- Full lint, TypeScript/production build and release-secret/browser-bundle checks pass. The static UI audit reports the same eight previously verified delegated-handler/Swiper affordances; no fresh clean static-audit claim is made. Profile and planner browser Axe checks pass.
- About photo sample: original 649,761 bytes; 640px WebP 66,106 bytes (90% fewer); 1080px WebP 167,962 bytes (74% fewer). These are image-transfer measurements, not a whole-site speed score.
- Private-media HTTP check: guest 404, authorized user 307 to a signed transform, derivative 200, private/no-store with Cookie/Authorization variance.

## Data safety and release evidence

The additive area migration was transactionally applied to the pinned client project after local schema/function and trip backups. All 15 existing itineraries remain, with no inferred area or deleted stops. An older trip asks its owner to choose an area before adding destinations. Existing notes, ordering and edits remain usable. An occupied plan cannot change to an area excluding a saved stop. Direct checks retain RLS on all three planning tables and revoke browser access to the prior helper. The Supabase advisor connector is currently denied; no fresh advisor certification is claimed.

The release target is [unlockparadise-staging](https://unlockparadise-staging.vercel.app). Git/deployment identity and hosted verification are recorded locally in `artifacts/client-refinement/release-evidence.json`. The screenshot packet in that folder contains only curated PNGs and an index, excluding credentials, traces and backups. Temporary synthetic plans are removed by each browser journey.

Google OAuth provider credentials, business SMTP and merchandise payments/fulfillment remain separately pending setup. Membership payment mode and permissions are unchanged; these checks create no real payment or outbound email.


## Hosted confirmation

All 22 hosted desktop/mobile journeys passed against the public staging alias on 25 October 2026, including real route tiles, optimized images, day/area behavior and exports. Verified application commit: `274ac1e45f7b8ada474ec7c562d91ecbaa3df447`; Ready Vercel runtime: `unlockparadise-staging-9s3btcupi-ayerkhalidesu-4298s-projects.vercel.app`. The following documentation-only commit changes no application behavior. Hosted About delivery also returns the 66,106-byte WebP. Final database cleanup and deployment details are retained in the local release evidence.
