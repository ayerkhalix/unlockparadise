# UI/UX audit — 29–30 October 2026

Audited the deployed staging site at commit `34a5877`, then fixed verified issues in shared components. The review preserves the existing navy, teal and gold design and the client-approved layouts.

## Findings and fixes

| Priority | Finding | User impact | Resolution |
| --- | --- | --- | --- |
| P1 | Login and registration emitted React hydration error 418. The legacy enhancer inserted password buttons into React-owned markup before hydration. | Password visibility icons could disappear and the form had to recover its render. | AuthForm now uses the established React PasswordField, including a distinct confirmation-password toggle. |
| P1 | Map attribution inherited a translucent background; sampled text contrast was 4.35:1. | Required provider credit became difficult to read over satellite imagery. | A shared opaque cream surface and dark token-based text retain readable attribution on all map surfaces. |
| P1 | The homepage attribution button had only about 24 × 22px of safe space. | Small or obstructed touch target, flagged by the WCAG 2.2 target-size check. | Map buttons use 44px targets. The control stack also clears the larger attribution control and existing floating-dock offset. |
| P2 | Only Itinerary Planner identified its current primary-navigation page. | Other sections and the account menu lacked consistent location feedback. | All main/account routes expose aria-current; mobile/account current links have teal emphasis and an underline. |
| P2 | Safari could return focus to the page body after closing a tapped mobile-menu opener. | Keyboard navigation loses its place after dismissal. | Modal supports an explicit return-focus ref; the public menu provides its opener. |
| P2 | Product-editor Brand and Collection controls briefly showed raw UUIDs while options loaded. | Internal identifiers appeared where users expected readable names. | CatalogChoice exposes a loading state and a readable unavailable-selection fallback while preserving the selected IDs. |
| P2 | Some Admin Studio refresh and pagination controls were 38px high on phones. | Smaller than the project's 44px touch target; more awkward to tap. | Phone-specific rules override compact desktop sizing without changing desktop density. |

## Scope and evidence

- Initial inspection: 46 route/viewport captures plus the mobile drawer, across guest, Explorer+ and admin sessions at 390px/1440px, with additional 320px checks on merch, login, membership and contact.
- Routes included homepage, destination browsing, destination details, merch/cart, membership, login/registration, About, contact, missing-page recovery, profile, Bucketlist, Portfolio, the itinerary library/editor/exploration, checkout and Admin Studio/Places.
- The audit used actual staging content. One exactly identified `[TEST] UI audit …` itinerary was created for editor/exploration checks and deleted after verifying its exact title. No client itinerary or catalog record was changed.
- Follow-up browser checks cover both password toggles, preserved values, invalid-form focus, keyboard account-menu access, current-route feedback, map pointer access/contrast, mobile admin targets and reaching the long product editor's Publish section. Opening the product editor does not publish or save a product.
- No document-wide horizontal overflow was observed in the initial sampled views. Intended photo strips/carousels were treated as internal scrolling, not reported as overflow defects.
- The missing-page response is streamed HTTP 200 with a `noindex` tag, as documented by the installed Next.js version. It was not misreported as a broken 404 screen.
- The floating control's bottom-of-document clearance already exists; its presence over a mid-scroll screenshot was not treated as proof that footer content is unreachable.

## Verification

- All 136 backend checks passed, including ownership, role/MFA boundaries, transactions, itinerary timing/order, original-image preservation and payment reconciliation.
- Production build, TypeScript, ESLint and release-secret checks passed.
- Chrome desktop/phone and WebKit desktop/phone checks verify the changed workflows. The initial test-only selector for the native summary disclosure was corrected to exercise its actual keyboard behavior. The admin touch-target check also caught and resolved a CSS-specificity conflict.
- The bundled Impeccable detector reported no primary findings in the sampled shared UI files; three type-scale advisories were checked against the established compact mobile typography.
- The complete Premium static scanner did not complete after more than eight minutes. A scoped strict run over the changed shared UI files plus the full project contracts/evidence passed with zero findings. No claim is made that a complete static scan passed.
- Ignored evidence and captures are in `artifacts/ui-audit/`. These are representative lab checks, not a claim of full WCAG certification or coverage of every stored record and device.

## Remaining follow-up

1. **Catalog cleanup:** the Admin Places list contains synthetic `browsing-… place` records, matching the historical browser-test fixture naming. Review which old test records should be archived before the client demo; this review did not remove historical content.
2. **Product source photo:** Forge Your Path Tee still needs a larger real photograph, as recorded in the image audit.
3. **Legacy browser-test maintenance:** historical browser specs still reference pre-migration fixtures and retired cookie controls. Update those fixtures and assertions before treating the entire legacy browser suite as a release gate; the changed-workflow browser matrix is the executed evidence for this pass.
4. **Launch configuration:** Google provider activation, business-email SMTP and merchandise payment/fulfillment remain separate setup/business work. These are existing launch items, not newly discovered layout bugs.

The interface is coherent overall. Further visual work should target a demonstrated problem rather than replacing the client-approved design or adding decoration.

The [expanded checklist](UI_UX_CHECKLIST.md) records the 30 October follow-up: smaller public mobile layouts, responsive cover-preview delivery, a source-photo inventory and further prioritized checks.
