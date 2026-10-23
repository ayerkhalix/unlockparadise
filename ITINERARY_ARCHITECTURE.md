# Itinerary architecture

Phase 2 uses the existing Supabase project and session/RLS boundary. `itineraries` stores owner, title, notes, optional inclusive dates, version and timestamps. `itinerary_days` stores ordered day numbers. `itinerary_items` stores a Place, day, zero-based position and private note. There are no copied destination descriptions or coordinates in a user's plan.

## API and transactions

- `GET/POST /api/v1/itineraries/`: list owned trips or create one.
- `GET/PATCH/DELETE /api/v1/itineraries/:id/`: retrieve or mutate an owned plan.
- `GET /api/v1/planning-places/?search=...`: published Places readable by the caller, including permission-filtered thumbnails and coordinates.

PATCH actions: update, add_day, add, remove, move, notes and reorder. Every mutation supplies the last received version. The private RPC checks the current Auth identity, locks the owned parent row, verifies that version and commits the entire operation atomically. The public wrapper is security invoker. Authenticated users have owner-filtered SELECT policies and cannot bypass validation through direct table writes.

An incorrect owner receives 404. An old version receives 409 with a reload instruction. Custom `PT404`/`PT409` exceptions avoid treating business errors as retryable 5xx transaction failures. See the [PostgREST error contract](https://docs.postgrest.org/en/v14/references/errors.html).

## Invariants

At most 100 trips per user, 60 days per trip and 50 stops per day. A composite foreign key ensures that a stop's day belongs to the same trip. A Place appears once per day; it may appear on separate days. A deferrable unique order constraint permits atomic reordering. Reorder must contain every current stop exactly once. Moving compacts the old day. Shortening a trip cannot discard occupied days. Dates must both be set or both absent, with an inclusive duration of 1–60 days. Removing a trip cascades its days and stops; deleting a referenced Place remains restricted.

## Access and interface

Explorer users can plan Places available to their membership. Explorer+ visibility remains enforced by existing Place RLS. If a saved stop becomes unpublished or restricted, the plan keeps its own note but returns a null Place preview and offers removal. No API serializes protected details as a fallback.

The unified workspace is `/itineraries/`, with `trip` and `day` query parameters for direct links. Without a selected trip, the server opens the owner's most recently updated plan; with no plans, creation appears inline. A native trip switcher and shared-modal New trip flow keep management inside the planner. Legacy creation/detail routes redirect to this workspace. Create opens the newly persisted trip, edit stays in place and updates the switcher, and delete opens the remaining most recent plan or first-trip form. The main navbar and account menu expose the same Itinerary Planner destination.

Desktop shows the day plan and map together; phones switch views. The inline destination finder loads the permission-filtered catalog once, supplies stable area/category options, filters names locally, and shows six results with explicit expansion. The map also has a keyboard/touch list. Markers show locations, without fabricated route optimization or navigation lines. Reordering supports drag and arrow buttons; moving uses a labeled day selector. Notes save explicitly; switching trips/days with an unsaved draft requires a shared discard decision. Errors retain task context and expose reload. Cross-site additions preserve selected trip/day context and publish the confirmed returned plan to an open planner in the same tab.

Adding a Place to a plan does not save or visit it. Existing `member_places` remains the sole Bucketlist/Visited store.

## Verification

`tests/integration/planning.test.mjs` replays real migrations into embedded PostgreSQL and exercises ownership, access, duplicates, ordering, stale versions, moves, notes, dates, deletion, transport and recommendation rules. `tests/phase2.spec.ts` executes real staging browser/API persistence. Route/width evidence is in `artifacts/phase2/audit` (ignored). Final executed results are recorded in PHASE_2_TEST_RESULTS.md.
