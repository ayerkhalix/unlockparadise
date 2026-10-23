# Traveler Discovery

Staff can now select exact survey identities per Place to control eligibility in personalized suggestions. Empty selection keeps category matching; normal browsing and membership rules remain unchanged. See [Place discovery editing](PLACE_DISCOVERY_EDITING.md).

Implemented against pinned staging on 20 October 2026. Production and the original WordPress site are unchanged.

## Experience and routes

`/traveler-discovery/` is an authenticated four-step flow: interests, pace, travel style and companions. Native checkbox/radio choices support keyboard navigation; Back and Continue stay in the same document. Every answer is optional. Skip persists server-side. The final transaction returns a playful traveler identity, its explanation and links to personalized discovery or the account.

The result's Explore my picks action always opens the personalized homepage. Skip, confirmed cancellation and clearing preferences return to the validated requested destination. Navigation after those commits does not compete with an immediate route refresh.

Traveler invitation/result action links retain the shared button foreground through hover and focus. Their scoped rule prevents the legacy public anchor hover color from reducing contrast on a teal button; hover is included in the final axe coverage.

The global Bucketlist dock is suppressed on this focused questionnaire route, including the result, so it cannot cover questions or privacy explanations. It returns on normal discovery/account routes. Existing save, itinerary and flight behavior is unchanged.

`/account/` shows the current archetype separately from all chosen interest badges, pace and optional companion preference. Edit Travel Preferences reopens saved answers. Skipped/dismissed members retain a quiet edit link. A separate account checkbox changes public review sharing without repeating the questions. Its pending choice is explicit and disabled during the request; a failed request restores the confirmed setting and shows an inline error.

`/` keeps editorial Featured Destinations for guests and members with absent, empty or incomplete preferences. A completed nonempty preference set changes the ordering of four eligible Places, with factual category explanations. It does not remove anything from the map or catalog. Existing curated related-Place recommendations remain unchanged.

Review headers use the current approved public identity through the existing review author relationship. At most one archetype and two interests relevant to that Place appear; pace, style, companions, email and raw answers are never public. Opt-out is reflected on subsequent dynamic review renders and uncached API requests, including old reviews. Already-open documents are not pushed a realtime update.

Admin Studio's Analytics module adds a small aggregate-only section and a disclosure documenting supported types and category mapping. There is no personality CMS or individual preference browser.

## Taxonomy

| Stable interest key | Presentation | Existing category slugs |
| --- | --- | --- |
| beach | Beach Lover | beaches |
| island | Island Hopper | islands |
| mountain | Mountain Explorer | mountain-hikes |
| river | River Wanderer | rivers |
| waterfall | Waterfall Chaser | waterfalls |
| food | Local Foodie | restaurants |
| coffee | Coffee Explorer | coffee |
| culture | Culture Seeker | others |
| nature | Nature Explorer | rivers, waterfalls, mountain-hikes |

No taxonomy rows are added. Nature Explorer's group is explicit in its option subtitle. Existing category icons are reused; small cup/leaf SVG icons fill the two missing semantic cases. Existing Palawan photography, fonts, logo and runtime color tokens remain authoritative.

## Deterministic identity

`src/lib/traveler.ts` owns allowed answers and the client classification/explanation. The immutable database function computes the stored archetype, so submitted text cannot forge a result. Tests compare 512 interest/pace/style combinations across both implementations and check input-order stability.

As of 21 October 2026, identities use the six approved interest families: Beaches & Islands, Rivers & Waterfalls, Mountain Hikes, Local Visits, Food, and Coffee. All 63 nonempty combinations map exactly to the client-provided names in `src/lib/traveler-identities.json`. Selecting all six produces The Wildcard. Empty selections use the neutral Explorer label. Pace, style and companions remain optional preferences and do not change the identity.

Existing island choices merge into Beaches & Islands, waterfalls into Rivers & Waterfalls, and nature choices into Rivers & Waterfalls plus Mountain Hikes. The migration preserves privacy preferences and recomputes saved identities.

## Ranking and performance

`traveler_featured` ranks on the server and returns at most 12 rows (four on the homepage). A matching existing category adds 20, editorial featured status adds 4, and factual recorded hike duration adds at most 1 for a compatible stated pace (adventure: at least 120 minutes; slow: at most 60). Missing durations add nothing; they never imply difficulty, safety, transport time or family suitability.

First matches from different categories precede repeats. Two strong matches from the same category are followed by an eligible editorial/unmatched discovery when one exists, before further repeats. Stable feature order, publication time and UUID break remaining ties. Publication/destination listing checks, existing RLS and the existing premium entitlement function filter candidates. A guest never calls the authenticated ranking RPC. The browser receives only rendered cards, not the full catalog or another account's preferences.

There is no shared user-dependent cache. Root rendering is dynamic; API responses use the existing `private, no-store` helper. The category join indexes and preference primary key already support lookups; no unnecessary JSON or array GIN index is added.

## Persistence, registration and recovery

Two versioned additive migrations create `traveler_preferences`, guarded functions, policies and the new-profile trigger. Existing profiles receive no backfill. Future profile creation adds a pending, private row independently of user-controlled Auth metadata.

Signup's terms, email guard and verification behavior remain intact. Only after a valid session does signup/login/confirmation choose discovery for a pending member. Existing absent/skipped/dismissed/completed accounts retain their normal destination. Staff roles are checked even at AAL1, and explicit admin destinations bypass discovery. Recovery retains its existing separate route/grant. There is no global onboarding middleware or forced account-page redirect.

`GET /api/v1/traveler/` reads the authenticated owner's row. `PUT` accepts a strict complete/skip/dismiss/clear operation and expected version; no user ID, membership, role or client archetype is accepted. The RPC locks the owner row and validates the version before one atomic update. Direct table writes also receive constrained enums, duplicate-interest checks, generated classification and a monotonic version. Invalid input cannot partially save. A conflict returns 409 and keeps the form's choices until the user deliberately reloads/discards them.

Drafts stay in tab-scoped sessionStorage, keyed by user ID and server version, for up to 24 hours. They contain only these non-sensitive questionnaire fields, never credentials or tokens. They are cleared after save, skip or confirmed cancellation and ignored after a conflicting server update. This preserves interrupted progress without writing partially completed answers to public or analytics tables. Private browsing/storage failure is explained; persistence of the final commit still depends on Supabase.

## Authorization and privacy

All exposed preference rows have RLS. Only the owner can select, insert or update; a caller cannot reassign ownership. Anonymous users have no table grant and administrators do not gain individual answer access. Existing profile, membership, role, review ownership/moderation and MFA policies are unchanged.

Public badges default off, including new users and skipped records. Both onboarding and the account editor require an explicit checkbox action. The projection accepts at most 100 review IDs and returns only review ID, generated archetype and up to two matching interest keys. Its private-schema definer implementation requires an approved review and the existing `can_view_place` authorization; the public wrapper is an invoker. It does not accept arbitrary author IDs. Review data and identities are loaded in a batch, never one profile query per review.

The administrative aggregate RPC checks the existing administrator plus AAL2 guard. Results remain suppressed until ten completed travelers exist; distributions suppress groups under five. No individual identifiers or private answers are returned. These are current preference counts, not invented historical completion or sales statistics.

## Verification and evidence

- `tests/integration/traveler.test.mjs`: classification, strict inputs, row ownership, privilege escalation denial, optimistic concurrency, generated identity, current public sharing, moderation, guest access, ranking diversity, premium/draft filtering and aggregate suppression.
- `tests/traveler.spec.ts`: real disposable staging identities, confirmation redirect, login, skip/dismiss, empty answers, interrupted draft, editing, personalized Featured ordering, failure/retry/deduplication, conflict recovery, review privacy, keyboard, offline/session recovery, reduced motion and a five-width axe/screenshot matrix.
- `artifacts/traveler-discovery/`: direction contract, captured screens, machine results and final review evidence. All credentials and test outputs remain ignored.

All 79 backend tests passed, including 11 new traveler tests and 512 SQL/client classification comparisons; all nine real staging authentication/MFA/RLS/Storage/entitlement acceptance checks passed. The five HTTP tests were rerun successfully after a test-only environment typing correction. All fifteen traveler browser cases pass across the final feature and explicit confirmation runs, with one intentional duplicate matrix skip. All 60 final captures/axe scans at the five required widths have no overflow, browser page errors or axe violations. Result and invitation actions are hovered during those captures. The initial labeled map container now has its region role before client initialization, so its loading state also remains accessible.

A fresh independent finish review found the mobile Bucketlist overlay; the canonical route exclusion corrected it. The same reviewer verified that correction and the subsequent action-contrast correction, with final disposition ship and no remaining scored fixes. See `artifacts/traveler-discovery/finish-review.md`.

The first broad 108-case run recorded 60 passes, 16 failures, six intentional skips and 26 cases blocked by serial fixture failures. It exposed the Skip navigation race and legacy hover-color collision; several other failures waited for full asset loading or stalled/aborted requests in the long-lived development server. Tests now wait for document readiness plus actual interaction/response assertions where appropriate, preserving all functional assertions. After a server restart, the explicit 39-case corrective run passed 37 cases. Its two motion-fixture failures read a pending count or let the archive's initial sort change a `.first()` locator after recording a Place ID. The corrected tests wait for the confirmed count and pin the selected Place UUID. The final four desktop/mobile motion cases all passed.

Final combined coverage: **102 unique browser cases passed, six intentional skips, zero unresolved cases across 108 cases**. This includes all previously blocked serial cases. No single clean full-suite execution is claimed. `artifacts/traveler-discovery/coverage.json` records each case's latest result and its originating run; all initial failure logs remain available.

Final `npm run typecheck`, `npm run lint`, `npm run build` and `npm run check:release` all exited zero. The release check found no tracked private artifacts, suspected source secrets or server-secret modules in the production browser bundle. Design context passed YAML/JSON parsing, exact parity for all 28 narrative strings and Prettier; the installed launcher does not expose the official DESIGN lint, so that check is not claimed.

Final staging integrity passed: 384 Places, four products, twelve variants with unknown stock preserved, zero orders and zero analytics events. The retained acceptance Place remains published; the original two-stop itinerary and two baseline saved Places remain. Two test-created saves stranded by the failed mutation fixtures were removed only after trace verification, using the exact synthetic owner, Place UUID, recorded timestamp and null visited state. No original association was removed. All disposable traveler accounts are gone. See `integrity.json`, `save-cleanup.json` and `motion-network-ledger.json` in the evidence directory.

Static Premium strict audit reports the same eight pre-existing delegated/member/library-action parser false positives as Phase 3.1; no new findings. Its exit status remains 1 and is not reported as a clean strict-audit pass. Impeccable ran once on the new UI targets: zero primary findings, sixteen advisory type/radius values outside the limited DESIGN frontmatter ramp. The fresh reviewer judged the rendered inherited type/material/ground a match; advisories are retained rather than hidden. No second detector is run.

Run authenticated suites sequentially to avoid fixture-session interference. Commands: `npm run test:backend`; `npm run test:staging:authenticated`; `node --env-file=.env.local node_modules/@playwright/test/cli.js test`; `npm run typecheck`; `npm run lint`; `npm run build`; `npm run check:release`. The five-width matrix runs once in the desktop project; its duplicate phone-project case is intentionally skipped.

## Limits and environment settings

Chrome desktop/mobile emulation covers 375, 390, 768, 1024 and 1440px. This is not physical-device, Safari/Firefox or full assistive-technology certification. The new feature does not enable checkout, live payments or analytics consent.

Staging email delivery remains guarded by its existing configuration. A real Supabase-generated signup confirmation token verifies the callback/session/one-use behavior without sending SMTP mail; an actual delivered verification email is not claimed. Confirmation tokens are excluded from test traces and output.

The Supabase security advisor reports the same pre-existing Auth warning before and after migration: leaked-password protection is disabled. No database security advisory was introduced. [Supabase remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). This task does not change Auth service settings.
