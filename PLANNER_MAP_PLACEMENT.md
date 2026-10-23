# Planner map placement correction

The owner's screenshot identifies the right-hand “Your day, on the map” panel as the intended home for homepage-style discovery.

## Behavior

- The right panel defaults to Explore destinations: homepage satellite area pins, current photographic categories, destination pins/previews and direct adding to the selected day.
- Day stops switches that same panel to the existing numbered saved-stop map. Only one map mode is mounted in the panel at a time.
- The left column retains name search, area/category filters and result cards. Its Explore Our Map action focuses the right panel; it no longer embeds another map.
- On phones, Explore Our Map opens the same panel in Map view. Search by name returns to the day/search column. A ResizeObserver resizes the area canvas when a previously hidden phone panel becomes visible.
- Search and map share filtered inventory, current homepage taxonomy metadata, one cancelable catalog request and retry state. Membership boundaries and the existing versioned save API are unchanged.
- Changing the selected day updates the destination-add target while retaining the current discovery selection. Already-added destinations are disabled for that day; failed saves keep the preview available for retry.
- The category panel uses document flow rather than a modal/scroll lock. Keyboard/touch area and destination lists remain available.

## Verification

Evidence directory: `artifacts/planner-map-placement/`.

- Final targeted browser run: 6/6 passed, desktop and mobile. Tests assert that discovery is in the right panel, no map remains in the finder, additions persist to the selected day, another day can receive the same destination, Day stops shows the saved location, and existing itinerary edits/reordering/notes and failure retry still work.
- Full backend suite: 88/88 passed. Typecheck, full ESLint, production build and release-secret checks passed. Typecheck was run sequentially after the build to avoid concurrent Next generated-type replacement.
- Axe and overflow assertions passed in both changed map states and both viewports. The desktop and phone screenshots in `after/` were visually reviewed.
- Premium static audit retains the same eight existing delegated/library handler parser findings; no new findings.
- No schema migration or production deployment was performed. Test trip cleanup is exact-ID based; hosted integrity was reconciled after the browser run.

DESIGN.md, its sidecar, PRODUCT.md and UX-CONTRACT.md record this placement clarification. The local dev server remains running.
