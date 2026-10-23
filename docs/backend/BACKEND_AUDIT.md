# Backend audit

Audit date: 18 October 2026, Asia/Manila. Sources were read only. No production endpoint was mutated.

## Verified inventory

SQL: `reference/wordpress/u177262977_fo9WP.sql`, SHA-256 `b5bf61912f4364b791b588e623667d63946b26e85b96338dc8515c6af966729e`.
XML: `C:/Users/Ayer/Downloads/unlockparadise.WordPress.2026-10-15(1).xml` (not inside `reference/wordpress`).
Core: `reference/wp-content/plugins/unlock-paradise-core/`. Theme: `reference/wp-content/themes/unlock-paradise/`. ACF: Core `acf-json/` and `reference/acf-schema.json`. Uploads: `reference/wp-content/uploads/`. MU plugins: Hostinger preview and automatic-update helpers; neither is an application backend.
Recorder: `C:/Users/Ayer/Desktop/unlock paradise automation/website-recorder/`, including public, Explorer and Explorer+ captures and reports. Private captures are not copied into Git.

28 SQL tables; 21 users; 3,431 attachments; 384 published `place` posts; 4 `area` terms; 8 `place_category` terms; 7 `upd_review` comments plus one ordinary WordPress comment. XML has exactly 383 published Places, all present in SQL. The sole additional SQL Place is ID 5693, title/slug `title`. The user confirmed one manually created test record. Exclusion is based on set comparison and placeholder evidence, not creation order.

## Verified business implementation

Paths below are relative to Core unless prefixed with `theme/`.

| Domain | Actual source symbols and locations | Replacement |
|---|---|---|
| ACF CPT/taxonomies | `acf-json/post_type_69d5f6070e198.json`, taxonomy JSON files; loaded by `unlock-paradise-core.php` | `places`, `areas`, `categories`, join tables |
| Dynamic detail fields | `includes/places/fields.php`: `upd_classify_place_fields`, `upd_group_has_lat_lng`, `upd_place_is`, `upd_listing_meta_query` | Split public summaries and restricted details; preserve remaining source fields |
| Display controls | `includes/places/settings-cpt.php`: `upd_get_place_settings_post_id`; `display-settings.php`: generated ACF visibility/icon fields | Active settings post selected through the stored option, imported into `app_settings` |
| Registration/login | `includes/membership/auth.php`: `upd_handle_register`, `upd_handle_login` | Supabase Auth; minimum eight-character password and Terms consent; new requested email verification |
| Roles | `roles.php`: `upd_register_membership_roles` | Registered accounts are Explorer; trusted entitlements grant Explorer+; separate admin/editor roles |
| Access | `policy.php`: `upd_membership_level`, `upd_place_is_vip`, `upd_can_view_place` | RLS helper functions and verified SSR sessions |
| Password recovery | `recovery.php`: recovery handlers and `retrieve_password_*` filters | Supabase recovery token verification plus short-lived signed recovery grant |
| Profile | `profile.php`: `upd_handle_profile_save`, `upd_handle_password_change`, `upd_member_stats`, `upd_featured_place_rest_handler` | Owned profiles, current-password check, list-derived statistics and featured-place guard |
| Profile photography | `avatar.php`: `upd_avatar_allowed_mimes`, `upd_avatar_square_crop`, `upd_handle_avatar_upload`, `upd_handle_avatar_remove`, admin moderation handler | Size/MIME/decoder validation, re-encoding, private objects and moderation |
| Bucketlist/Visited | `bucketlist.php`: `upd_bucketlist_save/unsave/visit/unvisit`, `upd_bucketlist_rest_handler` | Atomic owned RPC; marking Visited clears saved; unsaving preserves visited |
| Portfolio | `ui.php`: `[upd_portfolio]` shortcode, `upd_member_feed_tabs`; `theme/page-portfolio.php` | Private collection of visited Places. No independent portfolio publishing or portfolio-photo feature found |
| Reviews | `includes/reviews/reviews.php`: `upd_can_review`, `upd_review_submit`, `upd_review_delete`, `upd_review_like_toggle`, `upd_review_rest_handler` | Public approved reviews, 1–5 stars, one per user/Place, delete and resubmit; no editing |
| Search/filter/sort | `includes/places/queries.php`, `includes/components/feed.php`, `assets/js/area-filter.js` | Indexed REST search; normalized filters; original DOM toolbar retained |
| Maps | `includes/components/map.php`: `palawan_map` shortcode; `area_hide_pin` metadata | Supabase area/category/map data; hidden pin does not remove an archive |
| Cards/homepage | `place-card.php`: `upd_place_images`, `upd_place_cover_id`, `upd_render_place_card`; `category-counts.php`: `upd_category_counts`; `hero-categories.php` | Public covers, permission-filtered strips, homepage features and category counts |
| Checkout | `membership/paymongo-api.php`: `upd_billing_plans`, `upd_paymongo_create_checkout`, `upd_billing_renew_available` | PayMongo hosted fixed-period checkout; auto-renew remains unavailable |
| Webhook | `paymongo-webhook.php`: `upd_paymongo_webhook_permission`, `upd_paymongo_webhook_handler` | Test-mode HMAC, timestamp checks, provider lookup and atomic credit RPC |
| Paid time | `billing-once.php`: `upd_billing_apply_once`, `upd_billing_start_from`, `upd_billing_sync_once` | Serialized account extension and permanent replay protection |
| Expiry/notification | `subscription.php`: `upd_subscription_entitles`, `upd_subscription_sweep`; `billing-once.php`: mail/sweep functions | Time-based access, outbox templates and deduplicated scheduler; delivery awaits approved provider |
| Contact | SureForms form 1438 and `assets/js/contact-form.js` | Existing fields submit to local rate-limited inbox; transport approval remains open |

Original Core REST routes include `/upd/v1/bucketlist`, `/review`, `/featured-place`, and `/paymongo`. Authentication/profile/avatar/checkout handlers use WordPress `admin-post` actions. Their nonces are replaced by verified sessions, strict origin checks and RLS. No WordPress privileged key or password hash is shipped to browser code.

## Verified, inferred and unknown

**Verified:** only `vip_content` controls Place access. `premium_content` exists in old ACF schema and disagrees with `vip_content` on many records; it is preserved independently. Feeds are open. Default ordinary Place pages require membership. Bucketlist/Visited require Explorer+. Reviews do not currently require a visited flag despite an outdated comment: executable `upd_can_review` checks membership, visibility and optional VIP write level.

**Verified:** monthly PHP 50, quarterly PHP 135, yearly PHP 420; periods 1/3/12 calendar months. New paid time starts from the later of now and paid-through. PayMongo auto-renew availability explicitly returns false. Subscription-provider synchronization is a stub. Permanent VIP role grants have no billing record. Database statuses alone do not prove a live provider integration.

**Inferred with supporting evidence:** 5693 is the confirmed test Place because it is the sole SQL-only published record and has placeholder title/slug. This inference is recorded explicitly in reconciliation.

**Unknown/blocked:** production `wp-config.php` overrides, active payment credentials/dashboard state, any existing external subscription continuity, refund business rules, approved transactional email provider, actual Hostinger plan/resources. Xendit-related legacy references do not establish an active Core checkout implementation. No provider switch is implemented.

**Requested security correction:** legacy recurring `active`/`past_due` can grant indefinitely without checking paid-through. The replacement requires trusted, unexpired paid access and denies unpaid/past-due/refunded/revoked states. Existing recurring accounts require provider reconciliation before activation. This follows the user's explicit access-security requirement.

## Infrastructure deliberately not migrated

Action Scheduler tables, WordPress links/options internals, LiteSpeed caches, Elementor metadata, form-plugin caches/payment infrastructure, WordPress comments unrelated to Places, edit locks, ACF underscore pointers and SEO-analysis caches. Content SEO values and unsupported domain metadata remain in restricted `legacy_fields`; the report lists excluded infrastructure keys. No source record is deleted.
