# Place discovery editing

Open Admin Studio → Places → Edit. Details, Traveler types, Nearby places and Photos have direct section links. The existing versioned Place save owns all changes.

## Traveler types

“Match automatically using categories” retains existing discovery behavior. “Choose traveler types” exposes searchable checkboxes for all 63 survey identities, including The Wildcard. Search matches names and underlying interests. Clearing the selection restores category matching.

An explicitly targeted Place appears in personalized Featured Destinations only when the member’s completed survey identity is selected. Explicit matches rank before general category suggestions. Normal browsing, map discovery and direct Place links still work. This setting never grants Explorer+ access or publishes a draft. Existing Places retain automatic matching; no assignments were invented.

## Recommended nearby

Add up to six staff-curated nearby stops, with a display name, Google Maps profile/share link, type and optional note. Reorder or remove rows before saving. These save atomically with the Place. Related destinations remain separate and keep their existing itinerary behavior.

With Google configured, pasting a link starts photo lookup. Direct IDs resolve to their profile; named URLs return candidates for staff to confirm. Saving waits for active lookups. Changing a link clears the previous match; failures preserve the draft. Without configuration, names, links and notes still save and render.

Published destinations display nearby stops before reviews. Available Google photos and addresses appear with attribution. Missing photos use the text layout. No distances or opening-hour claims are generated.

## Enable Google photos

1. Enable **Places API (New)** in Google Cloud with Maps Platform billing configured. Create a server key restricted to that API.
2. Fill `GOOGLE_PLACES_API_KEY=` in `.env.local`, then restart the dev server. Never use a `NEXT_PUBLIC_` variable for this key.
3. Edit a Place, add a nearby stop and paste its Google Maps **Share** link. Confirm the matching profile if needed, then Save Place.
4. Open the destination to preview its photo, attribution and Maps link. Set the same server variable when deploying staging.

Only staff-entered labels, notes, links and Google Place IDs persist. Photos, addresses, photo references and attribution content are fetched live with `no-store`, without importing files into Supabase Storage. Google data is displayed as a separate list, not plotted on Mapbox.

Reference: [Place Photos](https://developers.google.com/maps/documentation/places/web-service/place-photos), [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies). Before public activation, the site’s Terms and Privacy Policy must cover Maps Platform use as described there.

## Verification boundaries

The new columns inherit protected `place_details` policies. Constraints reject invalid identities, malformed or duplicate nearby rows and non-Maps links. `admin_save_place` retains staff assurance, optimistic version checking, sanitization, audit and access points. Targeting remains a security-invoker query over the viewer’s own preferences with VIP/draft filtering and category variety.

The staff-only lookup endpoint verifies origin, rate-limits requests and validates every redirect before fetching. Arbitrary URLs, credentials and ports are rejected. API secrets are sent only in server headers.

Local database/provider tests cover targeting, authorization, rollback, URL rejection, missing configuration and photo attribution. Browser coverage includes creation, failure recovery, ordering, persistence, reopening and public rendering at desktop/mobile widths. Real Google requests remain unverified because the owner chose to add the key later; provider behavior uses simulated responses.

Verification: 15 local tests passed; desktop/mobile Place audience and nearby persistence checks, access-point regression checks and axe scans passed. Lint, TypeScript and the production build passed. Staging migration `20261021205921_place_traveler_audiences_and_nearby.sql` is applied; existing Place assignments remain unchanged.

The security advisor returned only its existing notices: [RLS with no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) on the intentionally private staging-admin exception table, and [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). This change introduced no additional advisor findings.
