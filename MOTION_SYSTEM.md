# Travel motion

Runtime owner: `src/lib/travel-motion.ts`; lifecycle cleanup: `FlightLifecycle`; actual counts: `FlightCount` and the existing member/cart stores.

Bucketlist adds call the shared flight only after the existing Supabase mutation succeeds. Removal cancels the matching Place flight. Pending Place IDs still deduplicate requests and synchronize all repeated controls. Failures keep the previous state and show a dismissible error; no success flight is launched.

The custom 40×32 SVG plane uses the existing teal, off-white and gold. Both flight types use 41 samples of a cubic Bézier, an 800ms duration, actual viewport coordinates and shrinking scale. The plane rotates along the curve tangent. Products use the actual selected image; a visible product photograph supplies the origin, otherwise the clicked control does. The target is the actual floating Bucketlist or cart control, measured at launch.

Decorations have no pointer events or accessible content and never affect layout. A 300ms local flourish replaces travel when the target is absent, hidden, offscreen or outside the active native dialog. No corner is hardcoded as a destination. Reduced motion creates no traveling node and retains state, count and static receiving feedback.

There are at most six simultaneous flights. Each cleans up on finish or cancellation. Navigation, viewport resize, page hiding and lifecycle unmount cancel active flights. A receiving pulse preserves the target’s existing transform. Count changes animate only the real displayed value, without invented intermediate numbers.

`useFloatingClearance` measures fields, action controls, product titles/metadata and footer links near the dock’s actual bounds. It chooses the lowest clear position along that viewport edge, leaving an 8px control gap and keeping below the header. If no clear position exists it hides the dock. A preflight event settles clearance before the flight measures its endpoint; later repositioning cancels old flights. Transient notices, dialogs and map-owned controls are excluded from page clearance calculations. Existing form-focus/dialog visibility rules remain. The visible part of a partially offscreen source supplies the launch point, so a clipped photograph cannot launch a thumbnail outside the viewport.

Browser tests and four sampled frames per device/flight are recorded in `artifacts/phase3-1/motion/`. Timing is paused only for deterministic frame sampling; separate unpaused interactions and Playwright videos exercise natural completion. No animation changes authorization, persisted records, inventory, totals or checkout status.
