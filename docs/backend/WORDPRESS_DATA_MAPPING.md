# WordPress data mapping

| Source | Target |
|---|---|
| `wp_posts.ID` for Place | `places.legacy_id`, deterministic migration UUID |
| `post_name`, title, status, GMT timestamps | Slug, title, normalized publication state and UTC timestamps |
| `post_content`, `post_excerpt`, `description` | Restricted `place_details` content, excerpt and description |
| `vip_content`, `premium_content` | Two separate boolean columns; only VIP drives authorization |
| `listing_type` PHP array | `listing_types`; missing/empty follows verified `destination` fallback |
| `travel_time`, `accessible_by`, `assets` | Numeric travel time and array attributes |
| `weekdays_crowd`, `weekends_crowd` | Restricted crowd fields |
| `area_location_latitude/longitude` | Valid numeric pair; source 3991 is quarantined in legacy fields |
| `upd_featured`, `upd_feature_order` | Homepage feature and order |
| `_thumbnail_id`, `photo_1`…`photo_8` | Attachment-based cover and ordered gallery relations; duplicate positions preserved |
| `wp_terms`, term taxonomy/relationships | Areas/categories and join rows; no filename-based relationship guessing |
| `area_hide_pin`, area coordinates | Map visibility and area pin coordinates; archive remains public |
| Term `thumbnail` | Taxonomy media relation |
| `_wp_old_slug` | Legacy redirect rows |
| Attachment `_wp_attached_file`, `_wp_attachment_metadata` | Exact served source, dimensions, variants, original filename and file metadata |
| Attachment alt/title | Media alt and source metadata |
| Active `upd_place_settings_post_id` option | Settings post selected by source option, then `place_display`/`asset_descriptions` |
| `wp_users.ID` | Approved `profiles.legacy_id`; password hashes excluded |
| `upd_bucketlist[place_id].saved_at/visited_at` | Owned `member_places` rows after approved identity mapping |
| `upd_review` comments and rating/title/likes metadata | Reviews and owned likes after approved identity mapping |
| `upd_sub_*`, legacy VIP roles | Reviewed membership plan; recurring states require provider reconciliation |

The read-only dump parser decodes escaped MySQL string literals without executing SQL. The PHP parser accepts scalars and arrays only, counts UTF-8 bytes correctly, rejects objects and rejects malformed lengths. Unsupported literals fail the import.

Deterministic UUIDv5 mapping is shared by all destination, media and relation imports. Identity UUIDs come from Supabase Auth and are joined through reviewed legacy user IDs; they are never guessed from email strings.

Dates use source GMT values rather than assuming the execution host timezone. Metadata not explicitly mapped is preserved in restricted `legacy_fields` except documented WordPress/editor/cache infrastructure. Serialized values are decoded, never evaluated.
