# Admin dashboard

The dashboard at `/admin/` shares the application and Supabase project. It uses existing brand colors and separately scoped admin styles. Public page styles/layouts were preserved.

The layout requires an authenticated account with a trusted `user_roles` row. The dashboard/preview and every REST mutation additionally require AAL2. An administrator without MFA is directed to `/admin/mfa/`. Ordinary Explorer/Explorer+ users cannot acquire staff permissions through profile metadata. No public admin bootstrap exists.

Modules:

- Dashboard: actual publication, account, active entitlement and moderation counts plus audit activity. Restricted metrics show as restricted rather than fabricated zero values.
- Places: title/slug, description/content/excerpt, publication/draft/archive, independent legacy/premium flags, listing types, travel, accessibility, assets, crowds, coordinates, areas/categories, public cover and ordered eight-photo gallery. A Mapbox click picker appears when a browser token is configured. UUID/legacy-ID/title media search supports libraries beyond the first page.
- Preview: `/admin/preview/:id/` renders protected draft content only to verified staff.
- Media: upload, list, alt text, private/public classification, approval/revocation and guarded associations. Source-library deletion is constrained by foreign keys; financial/customer content is not deleted by a generic table editor.
- Users: profile browsing and administrator/editor assignment; final administrator removal is prevented in the database.
- Memberships/entitlements: actual statuses and paid-through values; administrator-only manual grant/revoke with reason/expiry. Provider reconciliation is required before stale legacy subscriptions are activated.
- Reviews: approve, hold or reject. Member review editing is not introduced.
- Settings: allowlisted site configuration; no arbitrary options/secret-key editor.
- Inbox, audit, payments and events: administrator-only operational inspection. No raw payment payload or password hash is displayed.

Admin mutations are audited at the database boundary. Image uploads are decoded and re-encoded before Storage upload; SVG and executable content are not accepted by the UI. Gallery/cover association checks require verified media; covers must be deliberately public.

Local PostgreSQL tests exercise creation, editing, publication, slug redirects, archive/delete safeguards, audit entries and MFA restrictions. Actual hosted admin sessions and Storage uploads have not been accepted end-to-end because no staging credentials were supplied. Do not mark this as production acceptance.
