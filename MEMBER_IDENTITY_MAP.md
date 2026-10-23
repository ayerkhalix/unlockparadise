# Member identity, maps and access refinement

Implemented 22 October 2026 against staging iitblbdqztuxdzpaetie.

- Account: avatar-overlap Explorer (blue) / Explorer+ (plan gold) label, 63 interest-based geometric emblems, Likes line, and existing review consent moved to Settings → Privacy. Existing preferences and identity names are preserved.
- Motion: water/current, coast, mountain trail, landmark linework, food and coffee steam layers. Reduced motion is static; hidden/offscreen emblems pause. Review emblems use a static compact variant.
- Planner: area/category/results/preview inside the map card; explicit active map-mode state; no View all stops; desktop removes redundant finder/map switches. Time entry, date-derived days and owner/version checks remain.
- FeatureLock: shared branded gate for free accounts on Bucketlist, Portfolio and Itinerary Planner. Existing data stays saved after expiry.
- Portfolio is the single visited-destination collection. The duplicate Visited Places links and page were removed; /visited/ permanently redirects to /portfolio/. Existing visited records remain in Portfolio.
- Destination privacy: raw premium Place, review, alias and related media metadata reads are denied to guests/free accounts. A fixed-field private projection returns generic labels, opaque UUID links and area/category taxonomy. No title-based search can match hidden premium rows. Existing named links redirect to opaque gates; old disclosures cannot be retroactively concealed.
- Checkout: quarterly savings ₱15 (10%) and yearly savings ₱180 (30%) with current prices; calculated from active server plans, not hardcoded sale amounts. No real payments were submitted by this work.

## Database

Applied migration: 20261022153649_member_identity_and_destination_privacy.sql. Browser access continues through caller-scoped Supabase clients. browse_places/locked_place implementations are private security-definer functions with narrowly enumerated output, published destination filters, revoked PUBLIC execution and explicit role grants; their exposed wrappers are invokers. The former plan_itinerary implementation is private and no longer executable by browser roles; the new guarded wrapper preserves its owner/version-locked transaction.

Hosted anonymous verification returned 0 raw premium rows, 383 safe previews and 169 generic premium previews, with all titles/slugs/media/details withheld. Existing security advisor notices remain: the deliberately deny-by-default private staging MFA exception table has no policies, and leaked-password protection is disabled. References: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. No new advisor findings.

## Verification

- 25 local database/domain tests passed: membership expiry/preservation, raw REST-equivalent role isolation, safe preview/search/media/review projection, existing planning ordering/times/versions and traveler privacy/ranking.
- All 63 SVG compositions render distinctly and order-independent interest masks remain stable.
- Profile, consent persistence, free/guest gates, hidden titles/URLs and checkout savings passed desktop/mobile browser tests with axe.
- Planner discovery, category/preview bounds, active modes, existing time-entry persistence and route screen passed both desktop and mobile. A pre-existing Added-button accessible-name mismatch was corrected in the touched finder. All six new desktop/mobile scenarios passed across targeted runs; axe checks passed.
- TypeScript and changed-file ESLint passed. Production build passed with the completed visual changes. The itinerary page also short-circuits free-account data work before parsing trip IDs; layout/API/database checks remain independent. The final production build passed after that guard, and an authenticated free deep-link HTTP check returned the branded gate.

Screenshots: artifacts/member-identity-map/after/. Synthetic browser users and their trips are cleaned up by each test.
