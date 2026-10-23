# Browsing, catalog and travel editor expansion

Approved 21 October 2026. Implemented locally against isolated staging project `iitblbdqztuxdzpaetie`; no production deployment or checkout activation.

## Delivered behavior

- Homepage merchandise preview follows Featured Destinations; actual photos/names/PHP prices, previous/next controls, native touch/keyboard scrolling, product links and View all merch. Featured Destination itinerary actions are removed.
- One floating cart throughout merchandise routes. The upper breadcrumb retains only store navigation. The cart remains browser-local and checkout stays closed.
- Navigation orders About, Membership, Merch, Contact Us, Itinerary Planner, Profile. Guests can sign in/register through Profile; members keep account destinations. The logo returns home.
- Area archives offer an All area categories link and a selected category switcher that retains the current area.
- Product editing uses separate details, photos, options/pricing, optional Advanced and publishing sections. Native category/color/size/brand/collection choices can be created inline and reused. Slugs and SKUs are suggested and editable.
- Product photos upload directly into the current form. Covers, reordering, replacing and removing associations are explicit; other products' photos are not offered as choices. Upload limits remain eight photos, five MB each. Partial successes stay attached; the editor blocks navigation/saving while requests run.
- Brands own collections; product assignments are constrained in PostgreSQL. Original products default to Unlock Paradise / Unlock Paradise Collection. Storefront filters operate on the actual published catalog.
- Places use selection-first area/category/access/facility controls and suggested slugs. Up to twelve independent access points hold a name, known type, coordinates and directions. The Place transaction retains existing version and role checks.
- Destination and selected planner maps show access points as labeled teal square/icon pins, separately from destination coordinates. Text lists and Maps links retain access information. Coordinate pickers track edits and resize when disclosures open. Access points remain in membership-protected place_details.
- Trip creation has no day-count field. Inclusive dates determine days; an undated new trip starts with one day. Existing undated trips retain their length when edited. Add day extends dated plans. Occupied days cannot be removed by shortening dates.

## Staging accounts

Two dedicated owner-authorized client-review logins are stored only in ignored `artifacts/staging-private/client-accounts.json`. The admin has a real admin role, no MFA factor and one private allowlist exception. The Explorer+ account has a manual test entitlement and no admin role. No email was sent.

The assurance exception requires the verified staging Auth issuer, current user ID, enabled allowlist row and a real admin role. No migration seeds an exception. The server-managed staging_client_review app-metadata signal skips private allowlist queries for ordinary readers; authorization still checks the current allowlist and role. Other admins/editors/order managers retain AAL2; another project's issuer cannot use an exemption. The private allowlist has RLS and no browser/service-role table grants. Revoke the exact client row by disabling/deleting it. The admin footer reflects actual assurance and does not claim MFA verification for the client exception.

## Migrations

CLI-created migrations are aligned to their verified applied staging versions:

- `20261020195101_staging_client_admin_access.sql`
- `20261020195104_browsing_collections_and_access_points.sql`
- `20261020204633_staging_assurance_fast_path.sql`

The follow-up staging_assurance_fast_path migration avoids repeated allowlist reads for ordinary users. Map counts now request only area/category summaries instead of loading protected galleries and reviews.

No existing Place coordinates, product identities, stock, user stops or saved associations are backfilled or removed. New brand/collection columns default existing products into their original collection.

## Verification

Evidence directory: `artifacts/browsing-expansion/`.

- Backend: 86 tests passed, including assurance isolation/revocation, collection ownership/transaction rollback/version conflicts, coordinate validation/RLS and occupied-day preservation.
- Account proof: `accounts-verification.json` confirms client admin AAL1 with zero factors and actual admin/staff/orders access, Explorer+ AAL1 without administrative access, and the original admin denied administrative access at AAL1.
- Typecheck, full ESLint, production build and release-secret checks passed during implementation. Final source checks are recorded alongside their logs.
- Browser coverage: 114 unique desktop/mobile cases passed and six intentionally skipped across the full 120-case run and corrective reruns. The initial full run exposed stale editor selectors and staging query timeouts; updated fixtures and the assurance/map-count performance fix were verified in the corrective run. The final mobile Bucketlist timing check passed twice consecutively after waiting for source scroll/dock measurements. This is aggregate rerun coverage, not a claim that the initial full run passed. See browser-coverage-final.json and the retained logs.
- Real product uploads passed natural-image-dimension checks; admin brand/collection/product creation, Place/access-point persistence, cart reconciliation, dated itinerary creation/add-day, keyboard and accessibility flows passed on desktop and mobile. Five-width editor matrices run once under the desktop project; their duplicate mobile-project entries are intentionally skipped.
- Final integrity: 384 Places, four products, twelve variants with original unlimited-stock values, one default brand/collection, zero orders and zero analytics events. The original Palawan 2026 trip retains its version, dates and two stops; both original saved associations retain their timestamps. The pre-existing synthetic Place is preserved. Temporary test products, Places, brands, collections and trips were removed. See integrity-final.json.
- Premium static audit retains the same eight pre-existing delegated/library action-handler parser findings; no new static findings were introduced.
- Supabase advisors retain the existing leaked-password-protection warning. The new INFO for the unexposed deny-all private exception table is intentional (no access policies or browser grants). References: [password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [deny-all RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Design reconciliation

| Existing rule | Resolution |
| --- | --- |
| Outfit/Open Sans and navy/teal/gold | Preserved; the existing on-primary ink now has a public runtime token, --p2-on-teal. |
| Featured action inside cards | Superseded by the owner's explicit removal of Featured Destination itinerary actions. Other itinerary entry points remain. |
| Public header with compact account menu | Approved navigation order and profile photograph/person icon; existing account destinations remain. |
| Native selection/form/feedback owners | Extended through CatalogChoice, MultiChoice and the existing validation/upload/dialog owners. |
| Merchandise floating cart | Kept once; duplicate upper cart removed. |

DESIGN.md, its sidecar, PRODUCT.md, UX-CONTRACT.md and API/security contracts record these approved changes. No unrelated visual identity replacement, plugin upgrade, live payment activation, production changes or user-browser sign-out was performed.
