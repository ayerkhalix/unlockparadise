# Client plan delivery - 26 October 2026

Scope: CLIENT_PLAN_2026_10_26.md and the owner's approval of its date recommendation.

## Delivered behavior

- Planner exploration uses segmented transport buttons, Explorer+ filtering, native sorting, direction and reset. Search, travel-time filtering, the Assets disclosure and Show more are omitted. The catalog endpoint retrieves all RPC pages before returning the complete authorized result set.
- The Add destination card exposes one working name search with results always present, alongside Explore options. Schedule also makes its target day explicit when adding a stop.
- Schedule covers every trip day with dates, timed/flexible visits, empty days and expandable saved Notes. Editable card notes stay visible. Selecting a schedule stop opens and focuses its actual day/card; exports keep all saved notes.
- Delete day is a separate day-tab action, visible on hover/focus and directly on touch. Confirmation identifies the day, affected stops and resulting dates. It deletes only that day's stops/notes/times, preserves surviving identities and times, renumbers subsequent days and shortens the end date without changing the start. At least one day remains. Drafts, current ownership, premium access and version checks remain authoritative. Whole-trip deletion is in Edit trip.
- Normal and protected Places cards reserve matching 4:3 photo and white-body geometry. Existing authorized previews, proportional delivery, focal points, private media and fallback behavior remain.
- Category return has an accessible link name and pending feedback, initializes the intended photographic area panel immediately, and streams unrelated homepage sections separately. Exact Place/Back restoration remains.
- The public phone drawer opens from the right. Explorer profiles retain ordinary Bucketlist/Portfolio preview sections that lead to the appropriate feature hook. Redundant profile shortcuts and the Settings planner link are removed. One membership region precedes Settings in phone document order and remains a sidebar on desktop.
- Feature hooks use the compact gold-bordered reference card with Back outside; destination hooks retain photography and membership comparisons. Explorer upgrade links share direct checkout routing and safe return targets. Active Explorer+ membership shows actual access/status instead of acquisition prompts; the existing explicit Renew action in Settings retains extension checkout. Payment return memory is scoped to the transaction/user and expires after an hour; payment confirmation remains server-verified.

## Database safety

Migration `20261026050654_itinerary_delete_day.sql` extends the existing serialized planner transaction. The previous internal function cannot be invoked by client roles; public anonymous execution remains denied. Existing RLS, payment/entitlement logic, media and prices are unchanged.

Before applying it, a private backup captured every itinerary, day, stop and planner function definition. Immediately after migration, the data digest was identical: 16 trips, 47 days, 21 stops, 385 Places, 2,930 photo associations, 7 merchandise products and 3,437 media records. Tests create and clean up only owned synthetic trips. The final comparison also confirms all original trips/days/stops are unchanged and zero newly owned test fixtures remain. Migration, backup and audit evidence live in ignored `artifacts/client-plan-oct26/`.

The Supabase connector denies migrations/advisors for this project. The migration used the existing verified, explicitly pinned client database connection. No fresh Supabase advisor clearance is claimed.

## Verification evidence

The production build and 128 backend tests pass. Tests cover middle/first/last/sole-day behavior, the 60-day boundary, flexible dates, preserved notes/times/identities, stale/foreign/nonpremium rejection, version increments, helper privileges and safe tier-dependent upgrade returns.

Fourteen Chromium desktop/phone journeys and ten WebKit desktop/phone journeys pass. Four additional focused phone checks confirm the final right-drawer geometry, hook Back styling and toolbar at narrow widths in both engines. Evidence covers Safari-native time fields, retry/Undo, exact browse returns, protected actions, sorting, Notes, loaded-empty states and scoped Axe checks. Hosted acceptance is recorded with the release identity. Screenshots include Schedule, delete confirmation, search, exploration, profile, feature hook, membership status, category return and the right-side drawer.

ESLint, type checking and design-document lint are run against the final changes. The design-document lint retains 32 established warnings and no errors. The premium static auditor timed out in its HTML/regular-expression parser, including a bounded diagnostic run; it does not supply fresh full-project clearance. Runtime accessibility and workflow evidence are independent of that tool.

No physical Mac was available. Chromium and Windows Playwright WebKit are the compatibility evidence; a physical Safari smoke check remains useful. No real payment, message, email or client trip deletion is part of testing.

## Release

Final commit, canonical Vercel alias, browser counts, hosted acceptance and the final original-data audit are recorded in the private release evidence after verification. Staging: https://unlockparadise-staging.vercel.app/.
