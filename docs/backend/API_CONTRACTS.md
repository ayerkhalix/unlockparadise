# API contracts

REST is versioned at `/api/v1/`. Cookie sessions serve the web UI. Mobile clients authenticate through Supabase Auth and send `Authorization: Bearer <access token>` to these interfaces; no service key belongs in a mobile application. PostgreSQL RLS is shared by both clients.

Responses use JSON. Lists return `{data: [...]}`. Errors return `{error: string}` and optionally field validation details. Statuses: 400 invalid input, 401 unauthenticated, 403 denied, 404 unavailable, 409 conflicting/duplicate, 413 oversized, 429 throttled, 503 unconfigured/unavailable. Private responses use `Cache-Control: private, no-store`. Browser writes require the configured Origin. API JSON requests are bounded; uploads have separate byte/decoder limits.

| Method/path                                    | Contract                                                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/places/`                          | `area`, `category`, `search`, `limit` 1–100, `offset`; published destination summaries and permission-filtered media |
| `GET /api/v1/places/:slug/`                    | Permitted detail; 403 restricted envelope without description/coordinates/gallery otherwise                          |
| `GET /api/v1/areas/`, `/categories/`, `/maps/` | Public taxonomy and map configuration; map coordinates concern public area pins                                      |
| `GET /api/v1/me/`                              | Owned profile and trusted access flags                                                                               |
| `PATCH /api/v1/me/`                            | Allowlisted display name, avatar preset and owned featured Place; no roles or premium flags                          |
| `GET /api/v1/bucketlist/`, `/portfolio/`       | Own saved/visited collection; Explorer+ required                                                                     |
| `POST /api/v1/bucketlist/`, `/portfolio/`      | `{place_id: UUID, op: save/unsave/visit/unvisit}`; atomic timestamp transition                                       |
| `GET /api/v1/reviews/?place_id=UUID`           | Approved reviews plus any own pending review; newest first                                                           |
| `POST /api/v1/reviews/`                        | `{place_id, rating:1..5, title<=80, body<=10000}`; unique per caller/Place, verified visibility and moderation       |
| `DELETE /api/v1/reviews/:id/`                  | Delete caller's own review; editing is deliberately absent                                                           |
| `POST /api/v1/review-likes/`                   | `{review_id: UUID, liked: boolean}`; unique owned like on approved review                                            |
| `GET /api/v1/memberships/`                     | Caller subscriptions and current trusted premium flag                                                                |
| `POST /api/v1/contact/`                        | `{name,email,message,website?}`; private inquiry inbox; empty honeypot and throttling                                |
| `POST /api/auth/login/`, `/join/`              | Email/password, safe local redirect; join additionally requires Terms consent                                        |
| `POST /api/auth/logout/`                       | Revoke current session                                                                                               |
| `POST /api/auth/forgot-password/`              | Approved email flow; generic successful response avoids account enumeration                                          |
| `POST /api/auth/password/`                     | New password plus current password or a verified recovery grant                                                      |
| `POST /api/auth/mfa/`                          | `op:list/enroll/verify`; TOTP factor and six digit verification                                                      |
| `GET /auth/confirm/`                           | Supabase OTP/PKCE verification callback, with strict token types and safe redirects                                  |
| `POST/DELETE /api/profile/photo/`              | Owned multipart JPEG/PNG/WebP upload up to 8 MB; 192px re-encoded square and moderation                              |
| `GET /api/media/:id/`                          | Public URL or authorized 60-second signed URL; no access without matching RLS                                        |
| `POST /api/payments/checkout/`                 | Trusted plan and UUID idempotency key; allowlisted test accounts only                                                |
| `POST /api/payments/paymongo/`                 | Raw signed sandbox provider event, separate from browser-origin authentication                                       |
| `GET /api/health/`                             | Process health and configuration status; not proof that remote services are reachable                                |

Database RPCs: `viewer_access`, indexed `find_places`, `set_member_place`, approved `review_like_counts`, MFA-only `admin_save_place`/`admin_delete_place`, and service-only payment/rate-limit/notification functions. Direct Supabase data access still applies table grants and RLS.

Admin REST at `/api/admin/` exposes paginated Places, taxonomy, media, review, profile, membership, entitlement, settings, inbox, activity, transaction and event management. Every operation verifies authenticated staff/admin and the database assurance policy (AAL2, with the explicitly authorized staging client exception documented in RLS_SECURITY.md); user/role/membership/settings/financial views require administrator access. Place mutations validate fields and run transactionally through one RPC. Delete requires an archived Place, its exact slug and no member-owned references.

No authenticated route uses a client-supplied owner ID as authorization. No page success state is treated as payment confirmation. Live public contract checks pass against the configured development project. Authenticated staging verification now passes using synthetic identities; see ../../PHASE_2_TEST_RESULTS.md. Email delivery and provider acceptance remain external gates.

## Phase 2 API additions

`GET/POST /api/v1/itineraries/` and `GET/PATCH/DELETE /api/v1/itineraries/:id/` manage owner-isolated, versioned trips. `GET /api/v1/planning-places/` searches only readable published destinations. `GET/POST /api/admin/recommendations/:id/` loads or atomically replaces MFA staff curation. Existing Bucketlist/Portfolio responses add permission-filtered Place previews; their write and membership rules are unchanged. Contact accepts an optional allowlisted topic, retained with the message. See ../../ITINERARY_ARCHITECTURE.md for mutation payloads and database invariants.

Registration via `POST /api/auth/join/` requires `email`, a password of 12–200 characters, matching `confirm_password`, and accepted `terms`. Confirmation is validated before calling Supabase and is never stored or forwarded. Login continues to accept existing passwords. Existing email-verification, rate-limit, generic failure and origin checks remain. The planning-places response also includes `map.areas` and `map.categories` from the same current taxonomy metadata used by the homepage; destination inventory remains membership-filtered. `GET /api/admin/merchandise/?collection=<uuid>` filters the server dataset before pagination and validates the collection ID.

## Browsing/editor expansion — 21 October 2026

GET /api/admin/catalog-options/ returns saved brands, collections and category/color/size choices to administrators. POST accepts kind, name and (for collection) brand_id; it creates one reusable option, validates the input and enforces administrator assurance plus origin/rate checks. Unauthorized users cannot add choices, including through direct Data API calls. Collection/brand ownership is also constrained in PostgreSQL.

Product POST/PATCH payloads accept optional brand_id and collection_id; legacy clients preserve the product's current assignment, and original products default to Unlock Paradise / Unlock Paradise Collection. Product version/variant/image invariants remain enforced by the existing transaction. Uploads still use /api/admin/upload/; the returned public media ID is associated directly with the current product.

Place payloads may include access_points: an array of up to twelve objects containing name, known type (Boat departure, Drop-off, Trailhead, Parking), latitude, longitude and directions. Omitting the field preserves existing points. Validation and persistence occur inside the same Place save transaction. Reads use protected place_details; public discovery summaries never expose access coordinates.

The itinerary form computes inclusive duration from dates and sends the existing day_count field internally. Flexible new trips send one day. Existing date-range, occupied-day, owner and version checks remain authoritative; Add day already updates the end date.

## Member refinement — 22 October 2026

GET/POST /api/v1/itineraries/, GET/PATCH/DELETE /api/v1/itineraries/:id/ and GET /api/v1/planning-places/ require Explorer+; signed-in free or expired accounts receive 403. Ownership/version validation is unchanged. /api/v1/places/ uses the caller-scoped curated browse projection; premium names, named URLs, photographs and details are absent for guest/free callers. Named hidden-place searches do not match those rows. A direct hidden-place lookup returns a generic 403 projection with an opaque UUID slug. Premium callers retain full permitted content.
