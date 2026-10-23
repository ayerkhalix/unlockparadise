# Places management

The editor now includes searchable traveler audiences and up to six nearby Maps recommendations, saved in the same transaction. See [Place discovery editing](PLACE_DISCOVERY_EDITING.md) for behavior, photo setup and verification boundaries.

The existing Place editor and transactional save RPC remain the content owner. Lists query only a bounded page of summary fields, thumbnail associations and area/category labels. Full details load when an editor is opened. Name search, area/category, status, access and recent/name sort use server queries; page/filter state is shareable and restorable in the URL.

The editor groups basics/publishing, description, listing taxonomy, travel information, location/assets, photos/gallery and SEO. Existing rich-text sanitization, map picker, verified travel durations, membership semantics and curated recommendations are retained. Search metadata is saved to `place_details.seo`; permitted detail pages consume it without exposing gated content through guest metadata.

Save Place, Save draft, Publish and saved-record Preview are explicit. Archived status removes a Place from discovery while retaining member history. Dirty work is protected on explicit back/navigation and unloading. Saves carry the exact Supabase `updated_at` value, including offset/microsecond precision; stale versions are rejected without overwriting newer content.

Permanent deletion requires Owner MFA, archived status and the exact slug. The database refuses deletion while referenced by saved/visited collections, itineraries, reviews, profile portfolios or recommendations. Gallery associations reuse existing media mappings; no library bulk-upload occurs. Admin uploads accept decoded JPG/PNG/WebP images up to 5 MB, use random server paths and do not overwrite existing objects.
