# Client refinements — 31 October 2026

- [x] Discover · unlock · claim and Start unlocking copy.
- [x] Remove the Portfolio heading's Itinerary Planner shortcut.
- [x] Underlined saved-place tabs with no filled active surface.
- [x] Build up your portfolio empty heading, no empty-state subtext, and Find destinations to add action.
- [x] Contact Us before Merch in desktop/mobile primary navigation.
- [x] Consistent space from Itinerary, Schedule and My route to Add destination.
- [x] One Save changes action for pending notes and visit times, replacing individual save buttons.
- [x] Save-before-exploring reminder and confirmation that persists edits before navigation.
- [x] Assets added to Explore options; sorting/direction and Explorer+ filtering removed.
- [x] Swipeable destination card photographs with keyboard and previous/next alternatives.
- [x] Gallery API links declared as images, with viewport-fitted lightbox sizing.
- [x] Signed in as directly above the payment button, as clarified by the owner.
- [x] Confirm one-time billing and replace repetitive No automatic renewal labels with Pay once. Explore for your chosen term.

The atomic save is additive migration `20261031140344_itinerary_save_changes.sql`. It uses a security-invoker wrapper over the established locked owner/premium/version planner mutation. A failed row rolls back earlier rows in the same save. Existing visit times, notes, photos, associations, roles and billing behavior are retained. The connector cannot access this project; the migration uses the pinned staging connection, with explicit function permission checks. A complete connector security-advisor scan was unavailable; scoped security checks and database/browser tests provide the executed evidence.

No automatic renewal was found in the active Xendit flow: sessions use PAY and payment-method saving is disabled. AUTOMATIC capture is capture of the current payment, not a recurring charge. Membership extension still requires another one-time purchase. No payment was created or charged during this refinement's checkout layout checks.

Verification evidence and screenshots are kept in ignored `artifacts/client-refinement/`. The focused browser spec is `tests/client-refinement-oct31.spec.ts`; database rollback/isolation coverage is `tests/integration/planner-save-changes.test.mjs`. Browser-created fixture itineraries are removed only after their exact `[TEST] Client refinements …` title is verified.

Executed verification:

- All 137 backend tests passed, including combined-save rollback, stale/foreign/free/anonymous rejection and original-image preservation.
- Chrome desktop and phone passed the new workflows and the existing five-mode exact-position return check. The older return spec was updated for the retired Sort by control; two timed-out test fixtures from its old selector were removed after exact ID/title checks.
- Safari/WebKit phone passed the new workflows, including retry after a simulated save failure, save-before-exploring, Assets filtering/reset, photo navigation and a real gallery image fitted without distortion. Gallery sizing was confirmed on real photographs in Chrome phone/desktop as well.
- Production build, TypeScript, ESLint and release-secret checks passed. The Impeccable detector reported no primary findings in the sampled changed UI components.
- A broad scoped Premium scan stalled and was stopped. A strict scan of the new photo component and payment form passed. A separate scan also flagged two existing saved-place buttons whose actions are delegated through `data-member-op` and `data-add-itinerary`; their real listeners were reviewed in MemberActions and TravelCompanion. This is a scoped result, not a claim that the complete scanner or every legacy browser spec passed.
