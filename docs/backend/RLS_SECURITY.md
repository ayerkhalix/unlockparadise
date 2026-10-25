# Authorization and storage security

Every domain table enables RLS. Explicit grants complement policies. The `private` schema is not exposed through PostgREST. Security-definer functions use an empty search path and qualified tables. Default public function execution is revoked, then individual entry points are granted deliberately.

| Actor | Allowed |
|---|---|
| Anonymous | Published summaries, public taxonomies/covers and source-classified public teasers, approved reviews and plans; no Place details, private galleries, profiles or collections |
| Explorer | Own profile and permitted ordinary Place details, review submission/deletion/likes; no premium details or collection mutation |
| Explorer+ | Valid paid/manual access, own saved/visited collections and permitted private gallery objects |
| Expired/revoked/unpaid | No premium access, regardless of profile metadata or stale UI |
| Editor/Admin AAL1 | No administrative mutation; elevated role does not bypass MFA |
| Editor AAL2 | Content/media/review management |
| Admin AAL2 | Account role/entitlement/settings/price management and operational audit data |

The signup trigger inserts an ordinary profile only. Public registration never writes roles or entitlements. Profile column grants exclude legacy identifiers, timestamps and administrative values. A featured profile Place must belong to the caller's collections. List mutations use an atomic RPC that obtains identity from `auth.uid()`, never from a caller-supplied owner ID.

Reviews have DB-enforced unique ownership and rating checks. The insert trigger supplies current author/owner/moderation status and timestamps. The owner can delete but cannot edit; staff may moderate. A database throttle supplements endpoint throttling. Displayed content is HTML-allowlisted, including direct database content.

Public storage holds only deliberately public imagery. Private storage reads require ownership or permitted Place access. Profile uploads use the server decoder/re-encoder and cannot be inserted directly by an ordinary browser. Archive originals are staff-only. Signed URLs expire after 60 seconds; private responses use `private,no-store` and vary by credentials. Five old public copies are removed and guarded; no Next image optimization endpoint can read those removed files directly.

SSR validates users with Supabase `getUser`; Proxy refreshes cookies with `getClaims`. Browser sessions use HttpOnly, SameSite cookies and production Secure flags. Browser mutations require the configured Origin; mobile Bearer tokens are verified against Auth and use the same RLS. Private pages are dynamic and are not cached across accounts. Development tier overrides are ignored once Supabase is configured and always disabled in production.

Embedded PostgreSQL tests exercise the real migration policies/RPCs for anonymous access, ordinary/premium users, expiry/revocation, AAL1/AAL2, cross-user mutation, privilege escalation, storage access, replayed payments and admin CRUD. The harness does not prove hosted GoTrue, PostgREST or Storage HTTP behavior; those tests are still required in staging.

Residual gates: actual provider secrets, SMTP/account email approval, production config overrides and deployment access. Full npm audit also reports inherited development-only Next ESLint dependency findings; production dependency audit is clean. No forced framework downgrade was applied.

## Hosted verification

Nine migrations are applied to confirmed development project `iitblbdqztuxdzpaetie`. All 27 domain tables have RLS. Explicit anonymous grants inherited from hosted defaults were removed from admin/member RPCs. Privileged implementations now live in the unexposed `private` schema behind public invoker wrappers; internal identity/MFA checks remain enforced. The final hosted security advisor returned zero findings. Thirteen foreign-key indexes were added and constant policy lookups use subselects. Overlapping permissive read/staff policies remain an acknowledged performance notice, not a disabled authorization boundary.

Eight real anonymous checks passed, including private metadata/media denial, role/RPC rejection and a denied tiny synthetic Storage upload. Authorized Auth/Storage/MFA/session and cross-user checks are BLOCKED until the development server-only key and synthetic identities exist. The 37 embedded tests do not substitute for those checks. Legacy public image redirects apply only after a session-scoped RLS SELECT. Private legacy images never redirect to WordPress: local staging may serve checksum-verified copies after authorization; deployed staging returns an authorized placeholder until private Storage is ready.

## Explicit client review exception — 21 October 2026

The owner authorized one dedicated password-only client admin in isolated staging. private.staging_admin_mfa_exemptions is unexposed, has RLS enabled with no access policies, and grants no browser or service-role table privileges. Only database-owner setup can add/revoke rows. private.has_admin_assurance checks the verified issuer against the pinned staging Auth URL, the current auth.uid(), an enabled allowlist row and an actual admin role. No user metadata grants access. A server-managed app metadata flag supplies only a fast negative check for ordinary readers; stale flags cannot bypass the current private allowlist or admin role. Existing admin/staff/order helpers retain their role checks; all other staff require AAL2. Migrations seed no exemption rows, and another project issuer cannot activate one. Revoke immediately by disabling/deleting the exact row. Public Auth registration remains an ordinary profile without any exception, role or entitlement.

Brands, collections and reusable merchandise choices are public catalog metadata. Only authorized admins can insert them. Products enforce matching collection/brand foreign keys. Access points reside on protected place_details and are validated transactionally; they are never included in anonymous map summaries or gated Place responses.

## Premium identity and planner boundary — 22 October 2026

Published premium places require active Explorer+ (or existing staff assurance) even for their base rows. Guest/free discovery uses browse_places, a fixed-field private projection with an invoker public wrapper: names become Explorer+ destination, slugs become UUIDs, and private media/details/reviews are absent. Hidden names cannot be searched through this projection. The 24 October client exception below permits only an application-served cover preview and an explicit editorial Featured title; it does not relax these row policies. Related premium reviews, aliases and public-bucket media metadata obey the same membership boundary. locked_place only returns the generic published premium gate, including for old named aliases. No existing data or storage objects were removed.

Trip SELECT policies and the private plan_itinerary wrapper now require active membership as well as existing ownership/version rules. Expired data is retained. Application layouts, pages and APIs independently enforce this requirement.

## Client preview and journey expansion — 24 October 2026

The approved preview exception is implemented at the server boundary, without a public-bucket or broad RLS grant. `findPlaces` starts with the existing fixed-field projection. For opaque published premium destination rows it adds the opaque preview ID; it substitutes a title only when the request is explicitly editorial Featured and the stored Place has `featured=true`. Personalized ordering alone does not disclose the title. Non-featured names remain absent from projected search and locked card text/alt/links. Full guides, originals, details, coordinates and access points retain their existing policies.

`GET /api/previews/[id]/` accepts a UUID, checks published destination status and a ready cover, and resolves the allowed destination-public/private object internally with a server-only privileged client. It downloads a bounded input and re-encodes to a maximum 640×480 WebP, rotating pixels and stripping source metadata through re-encoding. It returns bytes with a five-minute public cache; it never redirects to Storage or returns the original filename/object path. An unpublished destination or missing cover returns unavailable. The cache can retain an already published preview for its TTL after a publication change; this exception applies to the derivative only. Re-encoding cannot remove an identifying caption burned into the photograph, so preview content still needs editorial review.

The additive `20261024084624_client_journey_start.sql` migration adds the bounded starting-point field to protected place_details. Its staff-checked, empty-search-path wrapper calls the prior versioned transactional save before updating that field; it revokes browser access to the renamed prior function. Existing RLS, content validation, role/MFA assurance (including only the already-authorized isolated staging exception), access-point protection and owner/version checks remain. No saved profile, Portfolio or trip records are deleted. The profile editor's shared lock and reload decisions complement rather than replace server checks.

The before-schema/function snapshot and hosted audit are recorded under `artifacts/client-todo/`. The hosted audit reports details RLS enabled, anonymous writes denied, prior function execution denied to anonymous/authenticated callers, a safe definer search path, 385 destination-detail records and no invalid starting points. The current hosted Supabase advisor request was denied; the older zero-findings result above is historical and does not certify this expansion. Local backend/browser results and remaining hosted release checks are tracked in CLIENT_TODO_DELIVERY.md; they do not prove complete hosted Auth/Storage/MFA or live provider delivery.


## One-area itinerary guard — 25 October 2026

`20261024155049_itinerary_area_scope.sql` adds nullable `itineraries.area_id` for legacy compatibility. The new private wrapper rechecks authenticated premium access, owner and expected version under a parent-row lock. Creation requires one existing area; additions require the Place's membership in it. Area changes reject incompatible existing stops and roll back atomically with other validation. Renamed prior-function execution is revoked from browser and service roles. Existing owner RLS and the canonical versioned planner remain. The HTTP catalog independently scopes an owned trip to its stored area.

Before applying, the existing schema/function and all 15 trips were backed up locally. The transaction recorded migration history and reloaded PostgREST. All 15 trip rows remain; none was assigned an inferred area or deleted. Direct audit confirms RLS on all three planning tables and denial of anonymous new-helper and authenticated old-helper execution. The connector's current advisor request is denied, so no new advisor clearance is claimed.

Responsive private images use the existing session-scoped media lookup before issuing a transformed signed Storage URL; the Next public optimizer is never used for authenticated media. Widths are allowlisted, originals remain available, and the protected route retains private/no-store and Cookie/Authorization variance. Public previews remain their separate bounded, re-encoded API.
## UI recovery and focal points — 25 October 2026

Migration `20261024171213_ui_recovery_and_photo_focal_points.sql` was applied transactionally to pinned client staging after an ignored local record/function backup. It retains 2,930 photo associations, 15 itineraries and 7 products. It adds bounded focal_x/y association metadata and extends existing product image validation. Place saves keep prior crop metadata for retained images when an older client omits it; malformed focal data rolls back the complete save. Existing role/MFA/version/media checks remain canonical.

The new itinerary restore action locks the owned itinerary, validates its expected version, and delegates the existing add path for area/day/publication/duplicate/capacity/time checks before restoring notes and order within the same transaction. One restoration advances the version once. Superseded private mutation helpers are not executable by browser roles. Existing RLS remains enabled on place_media, merch_products and itineraries; no additional role grants or storage policies are introduced.

The current Supabase advisor connector remains denied, so this release claims direct SQL/transaction and integration-test evidence rather than a fresh advisor clearance. Original media objects are unchanged. Public preview crop work stays behind the byte-only bounded preview API; private delivery retains its session-scoped lookup and private caching policy.
