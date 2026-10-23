# Database schema

Migrations live in `supabase/migrations/`, in filename order. They are transactional. The embedded PostgreSQL tests execute these exact files against minimal Supabase Auth/Storage schemas.

| Tables | Purpose |
|---|---|
| `places`, `place_details` | Public feed attributes separated from gated HTML, coordinates, crowds, SEO and legacy fields |
| `areas`, `categories`, `place_areas`, `place_categories` | Normalized taxonomy and many-to-many relations |
| `place_redirects` | Source old slugs and redirects after an administrator changes a slug |
| `media`, `media_files`, `place_media`, `taxonomy_media` | WordPress attachment identity, checksums, original/size objects, cover/gallery order and taxonomy thumbnails |
| `profiles`, `user_roles`, `profile_media` | Auth-backed owned profile, protected administrative roles, moderated private photo |
| `member_places` | Independent saved/visited timestamps; Portfolio is its visited projection |
| `reviews`, `review_likes` | One review per account/Place; public approved content and unique likes |
| `membership_plans`, `subscriptions`, `entitlements`, `membership_history` | Verified prices, billing history and separate trusted access grants |
| `payment_transactions`, `payment_events` | Server-owned checkout mapping, unique session/payment/event IDs and reconciliation |
| `audit_logs`, `app_settings` | Administrative changes and allowlisted configuration |
| `contact_messages`, `notification_outbox` | Private inquiry inbox and deduplicated notification scheduling |

All 27 domain tables enable RLS. Domain identities use UUIDs; legacy IDs have unique constraints. Join tables use composite keys. Small plan handles and settings keys use stable text keys. Audit/history use identity counters. UTC `timestamptz` values are rendered in Asia/Manila where appropriate.

Coordinates use `numeric(12,9)` with range checks. An invalid source pair is preserved in restricted legacy fields and omitted from map output. Gallery positions and ratings are constrained. Parent deletion is restricted where it would break media/taxonomy references; account-owned data cascades or anonymizes according to its role.

Indexes cover publication/features, search vectors, listing types, taxonomy joins, active entitlements, member timestamp collections, review moderation, payment ownership and pending outbox scheduling. REST pages cap list sizes; the full archive deliberately retains the original client-side filter workflow for the current 383-place catalogue.

`private` contains permission, trigger and rate-limit helpers. It is not an exposed API schema. Security-definer functions set an empty search path and use qualified identifiers. Only named public RPC entry points have explicit execution grants.

Nine migrations are applied to confirmed development project iitblbdqztuxdzpaetie. Hosted content reconciliation and anonymous PostgREST/Storage policy checks passed. Production readiness still requires real synthetic Auth, authenticated Storage, MFA and complete user/admin acceptance; see SUPABASE_INTEGRATION_REPORT.md.
