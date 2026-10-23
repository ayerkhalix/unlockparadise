# Member planning and checkout refinement

22 October 2026. Local preview with the existing pinned Supabase staging project.

The selected planner day now uses a filled teal treatment and explicit Selected text, with pressed/current-date semantics. My route names the map of the selected day's destinations. Adding from planner search, map discovery or the destination-page itinerary picker supports optional start/end times. Saved stops display the range and duration, and support editing or clearing times. These are Palawan wall-clock times on the same day; both endpoints are required when scheduled. Reordering and moving retain the stop's times; existing stops remain flexible.

The additive migration is `supabase/migrations/20261021163228_itinerary_stop_times.sql`, applied and recorded on staging. It adds nullable time columns with a paired, ordered, minute-resolution constraint and extends the existing owner/version-locked planner operation. Existing rows, membership rules and data visibility remain intact.

Checkout has a responsive two-column introduction/payment layout, native selectable period rows, a live total, signed-in identity, explicit sandbox restrictions and verified payment status. Existing Xendit verification and five-second confirmation countdown remain authoritative. Profile has a desktop membership/preferences sidebar, destination previews and readable settings, with a stacked mobile layout.

Executed validation: 11 planning database/schema checks; six desktop/mobile planner/profile and Xendit scenarios; two desktop/mobile planner failure/retry cases. Accessibility and overflow checks passed on the inspected screens. Targeted ESLint, application typecheck and production build passed. Evidence is in ignored `artifacts/member-refinement/after/` and `artifacts/xendit/after/`. Temporary test trips were removed through their owner-checked API. Supabase advisors retain the existing private-table default-deny informational notice and the existing Auth leaked-password-protection warning; no authorization policies were widened.

The original mini-map and cross-site picker regression tests were updated for the focused time-selection step. No deployment, live payment, email configuration or bulk media work is included.
