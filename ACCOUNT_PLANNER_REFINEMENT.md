# Profile, collection, planner map and registration corrections

Implemented locally against the existing staging project. No production deployment or schema migration was needed.

- Navigation displays the saved profile photograph, or a person icon when no photo exists. Profile remains its accessible name; the guest/member account disclosure keeps its existing keyboard behavior.
- Admin merchandise always shows Collection, even with one collection. Options come from the saved catalog; filtering runs on the server before pagination and persists in the URL. Option-load errors provide retry.
- Planner discovery reuses the homepage satellite area map and current area centers/category photos. Choose area, category and destination inside the selected trip/day, then add the stop. Back retains the selected area. Saved destinations remain visible and disabled. Compact categories stay inline, and text choices remain available if tiles fail. The separate selected-day map still shows itinerary stops.

The subsequent screenshot clarification places discovery directly in the right-hand “Your day, on the map” panel. Explore destinations is its default, with Day stops as its second mode. The left search section no longer embeds a map. See PLANNER_MAP_PLACEMENT.md for the corrected placement and later verification.
- Sign-in, register and password-recovery routes share the official Unlock Paradise mark, existing fonts and navy/teal palette. Input text stays light when idle, focused and autofilled. Password visibility uses inset eye icons with accessible labels.
- Registration includes a confirmation field and a 12-character minimum. Shared client validation and the server reject short/mismatched passwords. Existing login passwords, consent, email verification, generic errors, rate limits and safe redirects remain intact. Confirmation is never forwarded to Supabase or stored. Failed submissions retain input and permit retry.

## Verification

Evidence: `artifacts/account-planner-refinement/`.

- Final browser batch: 12/12 desktop/mobile cases passed, covering all changed flows plus homepage and full itinerary persistence. A later 4/4 confirmation batch checked focused-field color and the open native collection popup. An additional 10/10 regression batch covered home navigation, itinerary CRUD, account keyboard/logout and real staging signup-confirmation/token replay. These batches overlap; they cover 18 unique cases, not 26 unique cases.
- Full backend suite: 88/88 passed, including new confirmation/password and multiple-area/category/live-map metadata checks.
- Typecheck, full ESLint (zero warnings), production build and release-secret checks passed. A subsequent test-only lint check also passed.
- Axe checks passed for the changed auth forms, admin collection view, area/category view and destination selection on desktop/mobile. Screenshots are retained in `after/`.
- Hosted integrity: 384 Places, four products, twelve unlimited-stock variants, zero orders; the original trip retains two stops and the original two saved Place IDs remain. Temporary mini-map trips and browsing test products are absent.
- Premium static audit retains the same eight pre-existing delegated/library handler parser findings. No new static findings were introduced.
- Automated registration checks reject invalid requests before signup and intercept the form's unavailable-service case. The existing confirmation integration uses a generated staging link. No verification email was sent to the owner's real address by these checks.

`DESIGN.md`, its sidecar, `PRODUCT.md`, `UX-CONTRACT.md` and API contracts document the corrections. The dev server remains available at http://127.0.0.1:3000/.
