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

Published premium places now require active Explorer+ (or existing staff assurance) even for their base rows. Guest/free discovery uses browse_places, a fixed-field private projection with an invoker public wrapper: names become Explorer+ destination, slugs become UUIDs, and premium media/details/reviews are absent. Hidden names cannot be searched through this projection. Related premium reviews, aliases and public-bucket media metadata obey the same membership boundary. locked_place only returns the generic published premium gate, including for old named aliases. No existing data or storage objects were removed.

Trip SELECT policies and the private plan_itinerary wrapper now require active membership as well as existing ownership/version rules. Expired data is retained. Application layouts, pages and APIs independently enforce this requirement.
