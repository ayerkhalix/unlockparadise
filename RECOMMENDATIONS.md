# Curated recommendations

Related Unlock Paradise destinations remain the relationship model described below. Staff can additionally maintain a separate “Recommended nearby” list of external Google Maps profiles, saved with the Place. See [Place discovery editing](PLACE_DISCOVERY_EDITING.md). Neither list invents establishments or calculates proximity.

`place_recommendations` stores source Place, recommended Place, position and optional type. Composite uniqueness prevents duplicate relationships; a self-link is rejected. Position is unique per source, supports 0–11, and is replaced atomically by the MFA-authorized `save_recommendations` RPC. Source/target indexes and foreign-key cascades support lookup and cleanup.

The admin Place editor provides search over real published Places, add, remove, up/down ordering, an optional label, preview links, explicit Save recommendations, and inline load/save errors. Saving a draft relationship list does not publish a Place.

Destination pages render large photographic editorial links with the actual name, category/type, area and verified excerpt. Add to Itinerary opens the shared picker. RLS requires the viewer to read both source and target; the renderer also requires a published target and readable detail row. An inaccessible or unpublished Place is omitted.

There is no invented establishment catalog or proximity fallback. A page without curated records omits the section. Editors must curate actual relationships before those pages show recommendations. The heading does not assert a distance, and the UI makes no calculated nearby claim.

Database tests cover duplicates, self-links, staff MFA, atomic replacement and publication/access filtering. Real staging browser tests verify the section and admin label persistence using disposable synthetic Places.
