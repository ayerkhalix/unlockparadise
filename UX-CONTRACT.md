# Unlock Paradise UX contract

Place editor additions: an empty traveler audience means category-based matching; selected survey identities limit and prioritize eligibility in personalized suggestions, without changing ordinary browsing or membership access. Up to six nearby Maps recommendations save in the same versioned Place transaction. Missing Google configuration or photos retain useful names, notes and links. Lookup is staff-only, cancelable and rate-limited; pending lookup prevents Place save. Ambiguous matches require selection for a photo. Shared form validation, confirmations, dirty-state protection and theme tokens remain the owners. See [Place discovery editing](PLACE_DISCOVERY_EDITING.md).

## Product context

Authentication and privacy: login/join share the branded AuthForm and explicit Google OAuth button. Google starts only on user action, uses server-side PKCE and signed browser flow state, and returns through traveler discovery to a safe original page. New OAuth accounts accept terms in the shared form before continuing; provider identities never grant roles or membership. Missing provider setup produces an inline recoverable error, preserving email login. AnalyticsPreferences owns both the first-visit cookie notice and the existing footer preferences, with equally prominent allow/essential-only choices. Its portal reserves clearance for the floating dock, honors stored decisions, and fails analytics off if storage cannot save. See [Auth setup](docs/backend/AUTH_SETUP.md).

English interface for Palawan travelers in the Philippine market, with PHP catalog prices and Asia/Manila timestamps. Primary jobs: discover, save, plan and explore. Accessibility target: WCAG 2.2 AA. Visual identity and runtime token ownership are documented in [DESIGN.md](DESIGN.md).

## Business-context sources

| Scope                                  | Source                                                                              | Authority / reviewed                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Phase 2 behavior and content integrity | User's supplied Phase 2 master brief; PHASE_2_PROGRESS.md                           | Explicit task, 19 October 2026                              |
| Permission model                       | docs/backend/RLS_SECURITY.md; Supabase migrations                                   | Database grants/RLS and server access contract              |
| REST behavior                          | docs/backend/API_CONTRACTS.md; src/lib/validation.ts; src/lib/planning.ts           | Validated API contract                                      |
| Deletion                               | admin_delete_place and plan_itinerary migrations                                    | Exact archived slug; trip owner/version; referential guards |
| Billing                                | docs/backend/PAYMENT_INTEGRATION.md; existing payment routes and test configuration | No live payments authorized                                 |
| Legal copy                             | Retained privacy, terms and refunds fragments                                       | Preserve existing copy; no new legal claims                 |
| Merchandise                            | Original read-only merch repository; MERCH_INTEGRATION.md                           | Real catalog/local cart; checkout absent                    |

## Canonical UI Map

| Capability     | Canonical owner                                | Source of truth                                                  | Allowed variants                                          | Verification                              |
| -------------- | ---------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------- |
| Select/Listbox | Native select                                  | DESIGN.md                                                        | Platform popup; no authored listbox                       | Keyboard selection and narrow viewport    |
| Date           | Native date input and trip schema              | src/lib/planning.ts                                              | Date-only ISO storage; browser calendar                   | Validation, date ranges, keyboard         |
| Form           | ValidatedForm / validateFields                 | src/components/ui/validated-form.tsx; src/lib/form-validation.ts | React and retained fragments                              | Inline errors, focus, success/failure     |
| Scrollbar      | Global phase2.css                              | DESIGN.md                                                        | Admin paper scroller geometry                             | Computed style, forced colors             |
| Toast          | Feedback / notify                              | src/components/ui/feedback.tsx; client-api.ts                    | Success and error                                         | Live region, dismiss, no task obstruction |
| CRUD           | Versioned planning API and existing admin APIs | API_CONTRACTS.md; ITINERARY_ARCHITECTURE.md                      | Create opens planner; edit stays; admin save returns list | Full browser and database flows           |

Table selection is not a product feature. Do not invent bulk selection or all-results mutation semantics.

## State and navigation

| Operation            | Pending                         | Success                                 | Failure and recovery                   |
| -------------------- | ------------------------------- | --------------------------------------- | -------------------------------------- |
| Save / visited       | Disable matching Place controls | Update confirmed state and global count | Keep old state; visible error; retry   |
| Create trip          | Disable save                    | Open persisted planner                  | Preserve fields and error              |
| Edit plan / notes    | Disable affected mutation       | Show returned trip/version and notice   | Preserve draft; reload on conflict     |
| Delete trip          | Confirm title and stops         | Open remaining trip or first-trip form  | Keep current plan and actionable error |
| Add cross-site Place | Choose real trip and day        | Link to saved plan                      | Keep picker and allow reload           |
| Admin save           | Disable save                    | Return to existing list                 | Keep editor values and error           |
| Merch cart           | Validate stored product/variant | Persist browser-local cart              | Explain local storage failure          |

Admin datasets use server pagination of 50. Archive filters use URL state; selected planner day uses URL state. Picker searches and Bucketlist/merch filters are transient task state. Admin tab/search/offset restoration is handled by the console; no sensitive search terms are copied to global URLs. No write is queued offline. A timeout requires reloading server state before retrying a non-idempotent create.

The canonical planning entry is `/itineraries/`. With no trip query it opens the owner's most recently updated trip, or the first-trip form when none exist. `?trip=<uuid>&day=<uuid>` identifies a specific plan/day. The inline native trip switcher navigates between owned trips. New trip uses the shared modal over the current plan; Cancel retains that plan. First-time creation is inline. Legacy `/itineraries/new/` opens the same creation flow, and `/itineraries/:id/?day=...` redirects to the canonical URL. Main navigation and account navigation both label the destination Itinerary Planner. Unsaved stop-note drafts require an app-owned discard decision before switching trips or days. Edits refresh switcher labels; cross-site additions update an already-open plan through the shared saved-itinerary event.

The itinerary destination finder stays inline in the selected day. Its membership-filtered catalog supplies stable area/category choices while name search filters locally. Show six results initially with explicit Show more. Added stops remain visible and disabled in results for that day. Map mode uses the same filtered catalog; main-map links use normal navigation so Back returns to the saved planner/day.

Selected days use a filled teal button plus an explicit Selected label and pressed/current-date semantics. My route shows the selected day's saved destinations in plan order. Choosing a destination in planner search or discovery opens a focused add-stop form with optional Start time and End time; the destination-page itinerary picker uses the same fields. Times are local Palawan wall-clock times and require both endpoints, whole minutes and an end after the start on the same day. Flexible stops keep both values null. Existing stop disclosures display the time range and duration and permit editing or clearing it. All writes use the existing owner/version-locked itinerary transaction; changing day or trip protects unsaved notes and visit times. Times remain attached to the stop when reordered or moved.

Member checkout uses an editorial introduction alongside a single payment panel on desktop, stacking on mobile. Native radio choices show the full period price and a live Total today; selected prices remain server-authoritative at payment creation. The signed-in account, sandbox boundary and latest verified payment remain explicit. Profile places membership and traveler preferences in a desktop sidebar beside saved destinations and settings, stacking those sections on mobile without changing permissions or identity privacy.

## Overlays and feedback

`Modal` owns focus isolation, Escape, backdrop dismissal, body scroll lock and trigger restoration. It uses the browser top layer and a body portal. Desktop account navigation is a disclosure; mobile navigation is a modal drawer. Tooltips use one delegated system, including retained HTML, and expose descriptions on focus. Error details belong inline; notices do not replace recovery controls. A serious confirmation initially focuses Cancel. Focused text and select inputs hide the mobile floating control while typing; completing an action reveals it. Merch routes replace Bucketlist with a shopping-cart link and live item count.

## Validation and inputs

Product forms use noValidate and shared accessible validation. Required/type/range constraints feed textual errors, aria-invalid and aria-describedby; the first invalid field receives focus. Server errors retain entered data. Password fields support reveal/hide, paste and password managers. Search clearing is app-owned; remote search is debounced and canceled; IME composition does not issue partial queries. Textareas have fixed minimum reading space and internal scrolling.

## Async, ownership and access

Membership test checkout uses server-owned prices and durations. Its latest-payment status remains inside the existing auth-card layout, with a subordinate heading and inline feedback. Check payment status uses the authenticated owner's transaction and verified provider evidence; redirects never grant access. Xendit testing is explicitly labeled and restricted to server-allowlisted staging accounts. Duplicate clicks reuse an existing checkout, and ambiguous preparation keeps an explanatory state instead of submitting another session.

Payment confirmation returns identify an owner-scoped transaction. Pending returns automatically request authenticated verification; an already verified paid return, or a successful manual status check, starts a five-second return to Account. View membership permits immediate navigation and Stay on this page cancels the countdown. Pending, failed, expired, missing and foreign transactions never start it. A normal visit to checkout does not redirect merely because an earlier payment is paid. Xendit requires HTTPS return URLs, so the local HTTP demonstration still requires returning from the hosted payment page manually; the five-second timer belongs to the site's confirmation screen.

Server-confirmed updates are the default. Itinerary writes require the current owner and version inside one locked database transaction. Another owner's ID returns an unavailable response. Premium details, media and coordinates remain protected in search, recommendations and saved previews. A 401 asks the user to sign in; a 403 preserves the visible membership boundary. Local merchandising state is explicitly a cart, never a purchase.

## Responsive and accessibility

Audit widths: 375, 390, 430, 768, 1024, 1440 and 1920. Tables may scroll internally, while forms grow with the document. Planner reordering provides arrow controls as an alternative to dragging. Maps provide a keyboard/touch Place list. Floating controls respect safe areas and active forms. Reduced motion preserves state information. Native selects/calendar popup styling is intentionally platform-owned and is not represented as an authored menu.

## Verification

Run typecheck, ESLint, embedded database/security tests, Playwright desktop/mobile journeys, axe, route screenshots, production build and release-secret checks. `tests/phase2.spec.ts` covers CRUD and failure paths; `tests/phase2-audit.mjs` records route/width checks. Executed results and limitations belong in PHASE_2_TEST_RESULTS.md. Static skill auditing supplements these runtime checks.

## Admin Studio

Phase 3 uses the existing /admin application with eight modules and URL-backed section, committed filters, sort and page. Native selects and dates keep platform-owned popup behavior. The existing SearchInput, ValidatedForm, Modal/useDecision and notice system remain canonical; admin/shared.tsx owns the new repeated table, pagination and loading pattern. Lists request 25 records, cancel stale searches and clamp invalid pages.

Successful create/save returns to the owning list, preserves its query and announces server confirmation. Errors keep input. Exact update timestamps and product versions reject stale saves. Explicit editor back/module navigation and browser unloading protect dirty work. Publish, archive, deletion, role/entitlement changes, moderation and fulfillment use deliberate actions and shared decisions. Permanent Place deletion refuses user-history references. Financial state remains provider-controlled.

English Philippine currency and Manila dates apply. Amounts use integer centavos. Current collection snapshots, interest events and anonymous sessions are separately labeled. Optional analytics is off by default and browser privacy signals win. No cart action is treated as a sale; public checkout stays closed.

## Traveler Discovery

The authorized traveler brief and TRAVELER_DISCOVERY.md add four optional native checkbox/radio steps at `/traveler-discovery/`. The existing ValidatedForm, useDecision/Modal, requestJSON, session and versioned RPC patterns remain canonical. Native selection controls own keyboard behavior; no new select, dialog, notification or form framework is added. The progress indicator describes four actual steps. Result motion is a single short arrival and is absent under reduced motion.

Back/Continue preserve choices in the same page. Per-user, server-versioned tab drafts expire after 24 hours; storage errors are visible. Complete commits all answers transactionally, then shows the returned identity and a normal navigation link to discovery/account. Skip persists without public sharing. Existing-user invitation dismissal is persisted and does not hide the quiet account edit link. Editing and clearing use the saved owner version; failed or stale writes keep choices and offer explicit reload/discard recovery. A form's server error is scoped to that form rather than the framework route announcer.

The account's immediate-sharing checkbox is a named pending-toggle variant: it shows the requested choice while disabled, commits with the owner version, and rolls back on failure. It announces saving rather than claiming success before confirmation. The authoritative public projection reads current consent on each uncached request; it never reads private fields into review headers. Other open documents update when fetched/navigated, without a new realtime channel.

Only new profiles get pending discovery. Redirect selection runs after verified signup/login/confirmation, never as global account middleware. Existing accounts, administrators (including before MFA), explicit admin destinations and password recovery retain their existing workflows. Personalized Featured ordering filters publication and entitlements; anonymous/empty preferences use the standard editorial experience. Preferences do not hide the catalog or grant privileges.

The completed result's Explore my picks action opens the personalized homepage. Skip, Cancel and Clear retain the validated return destination; successful navigation does not immediately compete with a route refresh.

## Approved browsing/editor expansion — 21 October 2026

Primary navigation order is About, Membership, Merch, Contact Us, Itinerary Planner, Profile, on both desktop and mobile. The logo links home. Profile exposes guest sign-in/register or existing account destinations. Area/category navigation retains the area and exposes an All area categories link and current-category state.

Profile is represented by the member photograph or a person icon, with an accessible name and the existing disclosure. Auth routes share AuthForm; BackendForms and validateFields own submission and inline feedback. On sign-in and registration, the email form and its submit action precede Continue with Google, separated by an “or” divider; source order matches visual and keyboard order. The inset password eye control retains paste, password-manager autocomplete and independent confirmation visibility. Registration requires twelve or more characters and a matching confirm_password on both client and server. Existing login passwords remain accepted. Email verification, consent, rate limiting and safe redirects remain in place. Registration failures retain inputs and re-enable submission; confirmation is never forwarded to Supabase or stored.

The admin merchandise Collection select remains visible even with one collection. It uses reusable catalog options, URL state and server filtering before pagination; option-load failures expose retry. Planner map discovery uses area → category → destination within the selected trip/day, retains the selected area when returning, and marks saved stops as added. The category panel is inline rather than modal. Text area and destination buttons remain usable when satellite tiles fail. Individual map landmarks have distinct accessible names.

The right-hand Selected day map panel owns discovery, as clarified by the owner's screenshot. Explore destinations is the default mode; Day stops switches the same panel to the existing saved-stop map. There is no discovery map inside PlaceSearch. Its Explore Our Map action opens/focuses the right panel (the Map view on phones). Name search, area/category filters and right-map inventory share one cancelable catalog request and retry state. Selecting another day retains discovery and directs subsequent adds to that selected day. The compact area map observes its container so revealing a hidden phone panel resizes the canvas.

The homepage merch preview links into the real public catalog and supports arrows, keyboard scrolling and swipe. Featured Destinations no longer offer Add to Itinerary. Merchandise uses only the floating cart. Browser-local cart persistence, variant validation and closed checkout remain unchanged.

Public merch search, Brand and Category share one aligned filter row. On narrow screens that row scrolls horizontally rather than wrapping; every field retains its visible label and keyboard access. There is no public Collection select. Visible products are grouped into named collection sections, with Unlock Paradise Collection first and remaining collection names sorted consistently. Search and filters apply across sections, hide empty sections and retain the global result count and reset action. Admin keeps its separate Collection filter. The delegated tooltip owner uses the same dark surface, teal outline, rounded shape and inherited type as the floating Bucketlist/cart. Dedicated dock foreground/accent aliases preserve this contrast in both Admin Studio themes.

Product form selections use native controls and reusable saved brands, brand-owned collections, categories, colors and sizes. Creating an option stays inline and preserves product input; failure preserves the option name for retry. Product photo uploads use the verified public-media endpoint, maximum eight photos, five MB per image. A partial upload keeps successes; remaining failures can be retried. Product save stays disabled during upload. Removing/replacing a photo association never deletes an existing source file. New products get suggested editable slugs/SKUs. All saves retain version/role checks.

Place selectors preserve multiple selections. Optional access points carry name, known access type, coordinates and directions, with up to twelve per Place. They save in the same transaction as the versioned Place and stay in protected place_details. Map markers differ by shape, icon, label and color; text lists survive map failure. Selecting a planner destination reveals its associated access points.

New trip creation has no day-count input. Inclusive date duration is displayed; missing/invalid date pairs receive existing inline validation. Flexible trips start with one day; editing an undated existing trip preserves its current length. Add day updates the end date. Shortening refuses to discard occupied days.

A separately authorized password-only client admin exception exists only for an explicitly listed staging account and the verified staging token issuer. It is stored in an unexposed, non-browser-writable private table and requires an actual admin role. Other staff retain AAL2. Revocation is read directly, without relying on stale JWT metadata for authorization. A server-managed staging_client_review app-metadata flag short-circuits ordinary AAL1 readers; the flag alone never grants access. Production receives no exception rows and cannot match the staging issuer.

## Approved member identity/access refinement — 22 October 2026

The shared SavedPlacesPage owns both Bucketlist and Portfolio. Each route selects its tab and its own records; portfolio uses visited_at and unvisit, while Bucketlist uses saved_at and unsave. Empty portfolios keep the page header, tabs and filters and show an explicit empty panel. The unstyled duplicate member-links row is removed. Admin Studio has one desktop brand in its sidebar, alongside theme/account/website utilities. Its mobile menu carries the same utilities and retains modal focus management, permission-filtered navigation, unsaved-change guards and persistent theme choice. The 24 October contextual breadcrumb/date strip provides location and date; it does not duplicate desktop branding or account utilities.

The 23 October fixed-dock correction supersedes content-based clearance movement. FloatingDock portals the Bucketlist and cart to the body. Both stay at the same bottom-right viewport inset during scroll, content loading, filtering, count changes, and route transitions. CSS safe-area spacing, final page clearance, and scroll padding preserve access to the last page controls. Mobile field focus and open dialogs still hide the dock; it reappears in the same position when closed or blurred. No scroll observer searches for another position or hides it when nearby content changes.

Merch content editing exposes a Card highlight, Material, Fit, Fabric weight, Care instructions, and one-per-line Product highlights. Optional size-guide rows use native size choices and garment measurements in inches, retain saved values, reject duplicate/blank sizes, and can be removed. Empty copy leaves no trailing separators, blank details, or empty guide button in the store. Collection creation accepts an optional 160-character tagline; existing taglines can be saved or cleared inline. This global change is explicit in the helper text, admin-authorized in the API and database, and guarded against stale overwrites. Failure keeps the draft for retry; cancel restores select focus. The storefront shows each tagline below its own collection name. Mobile planner sizing preserves 44px controls and selected states, keeps map-mode controls on one row, and confines horizontal day scrolling to its own navigation.

This section supersedes earlier statements allowing free itinerary access, showing previews below a planner map, or placing public badge consent in the identity panel. All itinerary page entry points and endpoints require Explorer+; ownership and version checks remain mandatory. Database trip reads and plan_itinerary enforce active membership. Expiry never deletes trips; renewal restores owner access. Saved/visited previews are withheld from free profiles and remain persisted.

Guest/free premium discovery is a curated projection: generic name, opaque UUID link, public area/category only, no premium media, details, reviews, named aliases, search matching or raw Place rows. Private browse_places provides only explicit fields through an invoker wrapper; ordinary row policies now exclude premium rows. Authorized members/staff retain their existing access. Direct old named links redirect to opaque generic gates; previously disclosed names cannot be made unknown again.

Each interest combination has distinct SVG linework, owner Likes copy, and reduced-motion/offscreen states. Public reviews retain explicit consent; Settings → Privacy owns its existing versioned pending checkbox and rollback behavior.

The planner's map card owns category results, previews and keyboard/touch choices; no result list is placed below that card. Area/category browsing survives a day change. Both map modes expose a visible selected state; mobile has view switching, desktop keeps both columns available. The shared add-stop dialog retains optional paired start/end times and the owner/version transaction.

Checkout savings derive from the active same-currency one-month plan multiplied by the chosen duration, less its full period price. Only positive savings are shown; no missing baseline or different-currency claim is invented. Server-owned totals/payment creation are unchanged.

Portfolio is the only visited-destination collection. The old /visited/ route permanently redirects to /portfolio/; navigation offers no duplicate Visited Places entry. Destination controls use Add to Portfolio / Remove from Portfolio while preserving existing visited records and membership checks.

TravelerTitle is the shared profile/survey display title; public review badges stay static. It preserves the identity name as selectable accessible text and keeps Likes outside its decorative background. useAmbientMotion pauses title/emblem loops when offscreen, document-hidden or reduced motion is requested, and resumes when eligible. Mobile gives the full identity a separate header row; title wrapping must not hide the avatar, membership label, Likes or profile actions. This is presentation only and changes no saved preferences or consent.

Traveler glyphs use the original shared Icon component again across profile, survey result and public reviews. TravelerTitle retains the themed lettering and ambient animation; the separate icon remains static.

The latest profile revision omits the standalone traveler icon only on the profile. Its primary View map action navigates to the homepage #palawan-map anchor. Stop times are right-aligned beside the destination on desktop (above controls on phones), remain editable in their existing time disclosure, and use the destination-title size. Stop notes have no disclosure: their labeled textbox and save action are visible immediately. Save failure preserves drafts, and day/trip changes still guard unsaved notes or times.

## Usability refinements — 24 October 2026

Admin Studio's accepted redesign uses the existing eight modules and existing role-filtered links, grouped as Content, Business and Workspace after Overview. The single desktop brand and theme/account/website utilities stay in the navy rail. A sticky contextual strip shows the current module, editor context when open, and the Manila date. On phones it shows the supported official mark and named Menu action; the canonical Modal drawer retains focus isolation, Escape, trigger restoration and the same permitted navigation/utilities. The selected module uses aria-current, a translucent teal field and gold marker; subnavigation uses aria-pressed and an underline. Native selects, dates, shared validation, decisions, notifications and theme persistence remain canonical.

Overview's reading and focus order is authorized Place library, operational ledger/Create, then Recent activity. The desktop named grid keeps the ledger beside the library/journal; narrow layouts follow source order. Published photographs are real editor buttons with an accessible Edit Place name. The library preserves separate pending, failure/retry and loaded-empty states, and photo failure preserves title/edit access. Content staff see their Place/review work; administrators additionally see their allowed merchandise/member actions; order staff retain the existing orders summary. Counts come from authorized endpoints. Checkout remains closed and cart additions are never sales.

The runtime owners are admin.css for theme values/shared adapters and studio-design.css for the scoped shell, compact type, tables and motion. Rail widths are 228px, 204px at 1200px and below, and 248px at 1750px and above; navigation becomes a drawer at 800px and below. The contextual strip is at least 56px, or 60px on phones. Titles use Outfit at 30–40px/500, while Open Sans carries controls/data at 13px and metadata at 11–12px; phone fields remain 16px. Phone journal dates remain 11px and reflow below the action. The official white mark has a navy support surface in both themes.

Shared StudioTable owns its bounded scroller with layout/paint containment, sticky desktop headers and labeled phone records; natural editor document flow is not bounded by the table's height. Main actions stay 44px; compact table/pagination/sidebar actions use the authored 38px variants. Long editors retain sticky actions, exact-version saves, pending protection, dirty-work decisions and browser-unload guards. Module/editor arrival runs once over 240ms with visible-default opacity and a 6px heading settle; filter changes do not replay it. A 500ms photo expansion to 1.045 and subtle arrow travel occur only on interaction. Reduced motion makes arrivals and transitions immediate while preserving content, focus and state.

Admin data belongs to the exact resource/filter/reload request. Pending, failure and loaded-empty table states are mutually exclusive; a slow or failed request never implies that the dataset is empty. Shared tables remain bounded and the existing retry/login recovery controls apply. Recent activity and audit history use the same readable entity/action labels.

Bucketlist and Portfolio retain the same routes, tabs and saved records. Their filters appear only when there are saved records, including when a filter yields no matches. Empty accounts get the existing Discover Palawan action directly after the tabs.

The daily timeline sorts timed visits by start time for reading without changing saved stop order. Same-day overlapping windows are warnings, not blockers; touching endpoints and flexible visits are not overlaps. Adding and editing times retains existing server validation and owner/version checks. Print itinerary prints all saved days and notes, omits application chrome, and allows the browser's Save as PDF for offline use. Unsaved notes/times block the Print action with explicit save guidance. It creates no public share URL and performs no write or external upload.

Product preview reads current unsaved editor values and uses the storefront components in preview mode. It never changes draft/publication state, adds cart items or records analytics. Existing form validation and publish confirmations apply. Content readiness checks are suggestions rather than new business requirements. Merchandise remains preview-only; the separate Xendit membership sandbox remains explicitly identified.

Area and destination maps share loading/failure/retry feedback and keep keyboard/touch destination choices available during tile failures. Retry recreates only the failed map; selected-trip and saved-stop state are retained. Images reserve their existing geometry and show a photo-unavailable fallback instead of a broken-image icon.


## Client planner simplification — 24 October 2026

This supersedes the earlier always-visible stop notes, numbered drag handle and two-column desktop planner presentation. The selected day has Final itinerary and My route controls on every viewport. Final itinerary keeps the daily timeline and destination cards; My route opens only that day's numbered saved-stop map. Add destination exposes Search destination and Explore options. Search progressively reveals the existing local filters/results; Explore options opens the existing area/category/destination map. Returning preserves the selected day, search and map context. No duplicate map-mode toolbar or Add Place shortcut is shown above the cards.

Each stop's upper-right three-line native disclosure owns Move up, Move down, the native day select and Remove destination. Its click/Enter path and explicit actions remain usable without dragging; Escape/outside press close it. Holding that handle for 350ms starts pointer reordering, with a moving card, destination outline, live position announcement and bounded edge scrolling. Escape, pointer cancellation or window blur cancel without a mutation. Release over another stop commits the complete order through the same owner/version-locked endpoint. No optimistic order is persisted on failure. The number is a static sequence marker. Existing timings remain right-aligned and editable; Notes opens the labeled inline editor without discarding its draft when collapsed. Moving/removing a stop with unsaved work requires the shared discard decision; trip/day changes keep their existing guards.

Download trip saves a standalone, text-only HTML file made from the already-authorized PrintableItinerary DOM: all days, local times, notes and overlap warnings, without external requests, scripts or a new share URL. Its filename is bounded and normalized, and the Blob URL is revoked. Print itinerary keeps the existing browser print/PDF path. Both exports reject unsaved notes/times and are disabled during a plan mutation. Existing Explorer+ access, private destination projection, transaction semantics and server versions are unchanged.
