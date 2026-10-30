---
name: Unlock Paradise
description: Palawan discovery, saved Places and day-by-day travel planning in the established navy, teal and gold identity.
colors:
  primary: "#83d9c6"
  primary-hover: "#a4eadc"
  on-primary: "#08252b"
  background: "#081823"
  panel: "#102732"
  raised: "#18333e"
  text: "#f4f4eb"
  muted: "#b4c6cb"
  line: "#36515b"
  gold: "#dfc18a"
  membership-explorer: "#78b5f5"
  membership-plus: "#d4a344"
  studio-nav: "#102a35"
  studio-nav-text: "#e8f1eb"
  studio-nav-muted: "#bcd2cf"
  studio-nav-hover: "#203e48"
  studio-nav-current: "#83d9c61a"
  studio-nav-current-line: "#83d9c62e"
  studio-nav-current-text: "#b5f0e1"
  studio-dark-strong: "#a3e8d8"
  studio-dark-danger: "#ffb4a9"
  studio-dark-success-ink: "#a3e8d8"
  studio-dark-success-bg: "#183d3b"
  studio-dark-success-line: "#45766c"
  studio-dark-warning-ink: "#f3d79f"
  studio-dark-warning-bg: "#3d3423"
  studio-dark-warning-line: "#806a3f"
  studio-light-paper: "#f7f4ed"
  studio-light-surface: "#fffdf8"
  studio-light-ink: "#183d42"
  studio-light-muted: "#52696b"
  studio-light-line: "#cbd3cb"
  studio-light-teal: "#14665f"
  studio-light-hover: "#e7eee7"
  studio-light-focus: "#906119"
  studio-light-danger: "#a3352f"
  studio-light-strong: "#074c4a"
  studio-light-success-ink: "#185346"
  studio-light-success-bg: "#e0eee1"
  studio-light-success-line: "#a6c1af"
  studio-light-warning-ink: "#71511b"
  studio-light-warning-bg: "#f5ebd4"
  studio-light-warning-line: "#d7c292"
typography:
  sans:
    fontFamily: "Open Sans, sans-serif"
  headings:
    fontFamily: "Outfit, Quicksand, sans-serif"
    fontWeight: 500
  display:
    fontFamily: "Outfit, Quicksand, sans-serif"
    fontSize: "72px"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Outfit, Quicksand, sans-serif"
    fontSize: "56px"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Outfit, Quicksand, sans-serif"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 1.3
  body:
    fontFamily: "Open Sans, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.85714286
  label:
    fontFamily: "Open Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  input:
    fontFamily: "Open Sans, sans-serif"
    fontSize: "16px"
    lineHeight: 1.5
  editorial:
    fontFamily: "Georgia, serif"
    fontSize: "38px"
    fontWeight: 500
    lineHeight: 1.2
  studio-heading:
    fontFamily: "Outfit, sans-serif"
    fontSize: "40px"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  studio-section:
    fontFamily: "Outfit, sans-serif"
    fontSize: "22px"
    fontWeight: 500
    letterSpacing: "-0.025em"
  studio-body:
    fontFamily: "Open Sans, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  studio-control:
    fontFamily: "Open Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  studio-field:
    fontFamily: "Open Sans, sans-serif"
    fontSize: "13px"
    lineHeight: 1.6
  studio-data:
    fontFamily: "Open Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  studio-meta:
    fontFamily: "Open Sans, sans-serif"
    fontSize: "11px"
    lineHeight: 1.6
  studio-support:
    fontFamily: "Open Sans, sans-serif"
    fontSize: "12px"
    lineHeight: 1.6
  studio-photo-title:
    fontFamily: "Outfit, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.35
rounded:
  DEFAULT: "16px"
  control: "8px"
  button: "10px"
  studio-control: "8px"
  studio-input: "7px"
  studio-plane: "14px"
  media: "12px"
  modal: "20px"
spacing:
  page-max: "1240px"
  page-inline: "28px"
  page-inline-phone: "20px"
  section-gap: "48px"
  card-inset: "20px"
  card-compact: "16px"
  card-gap: "12px"
  studio-section-gap: "36px"
  studio-content-max: "1630px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "11px 18px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "11px 18px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    typography: "{typography.input}"
    rounded: "{rounded.control}"
    padding: "12px"
  card-body:
    padding: "{spacing.card-inset}"
  featured-card:
    backgroundColor: "#ffffff"
    rounded: "{rounded.DEFAULT}"
  studio-button-dark:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.studio-control}"
    rounded: "{rounded.studio-control}"
    padding: "9px 14px"
  studio-button-light:
    backgroundColor: "{colors.studio-light-teal}"
    textColor: "{colors.studio-light-surface}"
    typography: "{typography.studio-control}"
    rounded: "{rounded.studio-control}"
    padding: "9px 14px"
  studio-input-light:
    backgroundColor: "{colors.studio-light-paper}"
    textColor: "{colors.studio-light-ink}"
    typography: "{typography.studio-field}"
    rounded: "{rounded.studio-input}"
    padding: "11px 12px"
  studio-nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.studio-nav-text}"
    typography: "{typography.studio-data}"
    rounded: "{rounded.studio-control}"
    padding: "10px 12px"
  studio-nav-current:
    backgroundColor: "{colors.studio-nav-current}"
    textColor: "{colors.studio-nav-current-text}"
    rounded: "{rounded.studio-control}"
    padding: "10px 12px"
---

# Design System: Unlock Paradise

## Overview

**Creative North Star: "The Palawan map and travel notebook"**

The existing Unlock Paradise Palawan map, immersive destination photographs and original Outfit lettering define the visual world. Planning feels like arranging stops on a travel notebook alongside a satellite map. Destination guides use an editorial reading column and an ordered journey from city to shore.

Photography and maps carry expression. Home and merchandise support discovery; destination guides support reading; member planning and Admin Studio support tasks. Forms, tables, permissions and confirmations stay familiar and legible. Admin extends this same identity with a navy navigation rail, calm working surfaces and the existing official palm-lock mark.

**Key Characteristics:**

- Existing Palawan photography, maps and official identity assets.
- Outfit headings with Open Sans controls and data.
- Navy, teal and gold public surfaces; scoped navy and warm sand admin themes.
- Shared card anatomy, clear action boundaries and measured travel feedback.

### Product context and register

The audience is travelers discovering and planning Palawan trips. The supplied brief establishes Philippine destination content, English UI, Explorer/Explorer+ memberships, and a discover → save → plan → explore journey. Store prices use PHP; dates use English Philippine formatting and Asia/Manila where a timestamp is displayed. There is no Japanese market or locale requirement. Preserve original content and legal copy. Avoid a generic analytics dashboard, unrelated rebrand, invented travel facts or simulated purchasing.

Runtime CSS remains canonical (Model B). `src/app/phase2.css` owns `--p2-*`; `public/original/wp-content/themes/unlock-paradise/assets/css/tokens.css` owns retained `--upd-*`; `src/app/admin/admin.css` owns `--studio-*` and its scoped shared-component adapter. `src/app/admin/studio-design.css` owns the accepted Studio layout, compact type, navigation states and motion overrides. This file mirrors accepted source values rather than generating runtime styles. The sidecar adds preview snippets, motion, depth and breakpoint metadata; its generated tonal ramps are preview aids, not additional runtime palette tokens.

## Colors

Navy anchors the travel interface, teal identifies safe actions and focus, and gold marks membership and travel context. Off-white and muted blue-gray preserve readable hierarchy. The frontmatter records exact values; the role names below explain their application.

### Primary

- **Travel teal** (`primary`): safe public actions, links, focus and confirmed receiving feedback. `primary-hover` is the public action hover; `on-primary` is its dark ink.
- **Studio light teal** (`studio-light-teal`): actions and links on warm admin surfaces, with the light surface as inverse text. `studio-light-strong` supplies its hover. Dark admin actions use travel teal with `studio-dark-strong` for hover.

### Secondary

- **Travel gold** (`gold`): travel context, membership and dark admin focus. The existing legacy VIP gold remains owned by the retained theme; these related values are not interchangeable aliases.
- **Warm gold focus** (`studio-light-focus`): keyboard focus on the light admin worktable.

### Neutral

- **Deep navy, panel and raised** (`background`, `panel`, `raised`): page, contained layer and hover hierarchy.
- **Off-white, blue-gray and slate boundary** (`text`, `muted`, `line`): foreground hierarchy and thin divisions on navy.
- **Studio rail and rail text** (`studio-nav`, `studio-nav-text`): the same navy identity frame in both admin themes. `studio-nav-muted` carries group labels and supporting rail text; `studio-nav-hover` is the retained rail hover. Selected entries use the translucent teal `studio-nav-current` / `studio-nav-current-line` pair, `studio-nav-current-text`, a heavier label and a small gold marker. The phone's white official mark has a navy support surface in both themes.
- **Sand worktable and warm white** (`studio-light-paper`, `studio-light-surface`): optional light admin page and contained surfaces, with ocean ink, muted copy and separators from the corresponding light tokens.

Danger uses the theme-specific danger token. Admin success and warning badges use paired ink, background and border values from `--studio-success-*` and `--studio-warning-*`; archived/rejected status uses the muted/hover treatment. Preserve each pair together rather than borrowing a text color across themes.

**The Scoped Theme Rule.** Admin defaults to dark navy and offers a persistent warm light option only within the admin scope. Public pages and public-style admin Place previews retain their established palette.

`AdminThemeScope` receives the server-read, whitelisted `upd-admin-theme` cookie preference. Its toggle persists `dark` or `light` for a year and the initial server attribute agrees with hydration. The scoped adapter maps studio values into shared controls; dialogs, tooltips and notices carry the active theme into their portal context. Native controls inherit the active `color-scheme`. Forced-colors support remains available.

Selection, caret, scrollbars and focus derive from the same palette. Teal text is never used on the sand featured section; its controls use dark ink. Verify rendered contrast and inspect photography overlays visually.

## Typography

**Display Font:** self-hosted Outfit, with the retained Quicksand/sans-serif fallback stack.
**Body Font:** self-hosted Open Sans, sans-serif.
**Editorial Font:** Georgia, serif, limited to destination editorial headings, quotes and existing emphasis; it is not used in the store.

The original base typography remains the brand baseline. Quicksand draws the retained public wordmark; body copy and headings do not use the desktop-only Avenir brand file. The heading adapter mirrors the existing stack for merchandise. Outfit is restrained to admin headings and identity; Open Sans carries controls and data.

### Hierarchy

- **Display:** merchandise headline uses the frontmatter display ramp; at the phone breakpoint it is fixed to the ramp's minimum. This is a merchandise expression, not a replacement for every page title.
- **Headline / Title:** shared page titles use the headline ramp; section titles use the title role; shared third-level headings use (21px / 1.35). Below (520px), ordinary shared page titles use (34px); the later merchandise display rule keeps its own scale.
- **Body:** inherited public copy is (15px) below the retained desktop breakpoint and uses the frontmatter body role above it. Shared shell paragraphs use (1.65) line height; guide copy uses (17px / 1.9) within a bounded reading column.
- **Label / Input:** labels and buttons use the label role; shared form inputs remain (16px / 1.5). Keep visible labels and readable native controls at phone widths.
- **Admin:** Studio titles use the heading ramp at weight (500), fixed to (30px) at (800px) and below. Section headings use the section role; the overview's library/journal headings become (20px) below (600px). Third-level headings remain (18px). The inherited body base stays (14px); buttons and record text use their (13px) roles. Table headings, status labels, journal actions/dates and compact facts use (11px); photo areas, section descriptions and utility labels use (12px). Place photograph titles use the photo-title role and become (16px) below (600px). Fields use the compact field role on desktop and (16px) below (800px). Phone journal dates keep the metadata size and reflow below the action. MFA entry retains its separate (28–36px / 600) heading.
- **Editorial:** destination editorial headings use the editorial role; quoted prose uses Georgia (20px / 1.6).

Use tabular numerals for amounts and record counts. Preserve existing contextual metadata without adopting decorative uppercase eyebrows as a reusable typography role.

**The One Heading Family Rule.** New store and admin headings inherit Outfit from their shared owner; Georgia stays with the established destination editorial material.

Client PDF composition uses scoped sizes rather than new shared roles: profile names (24–32px), browser headlines (28–44px), destination-card/direction headings (21px), phone card headings (18px), and visual-editor text (15px). The profile's phone traveler-title override is (17px), superseding the earlier profile nameplate measurement only; survey/result lettering keeps its own owner. Controls and phone inputs retain the shared target/readability rules.

## Layout

New public pages use the frontmatter page measure and gutters, with phone gutters at (800px) and below. The desktop shell begins with the section gap; phone top padding is (32px). It reserves bottom room (100px). Dialog bodies scroll within the visual viewport. Content and errors remain reachable at short heights and increased text size.

**The Shared Card Anatomy Rule.** Use the shared inset, compact and gap tokens for card content. Destination bodies and featured card bodies use the shared inset; Featured Destination cards navigate to the Place and do not offer an itinerary action. Product text and purchase controls are separate semantic siblings; names wrap naturally. The compact step is part of the authored scale, not a blanket override of every card.

Account uses the full page frame with a responsive destination grid and disclosure settings. The compact identity header places a static circular avatar beside the name, traveler title and Likes; Edit profile and View map remain direct actions. The planner uses one selected-day work surface with Final itinerary and My route at every width. Its compact top toolbar retains the workspace name, native trip switcher and New trip action. New trip uses the shared modal over an existing plan; first-time creation is inline. Add destination retains inline name search; Explore options opens the dedicated photographic browser with the selected trip/day and a View final itinerary return action. This supersedes the earlier adjacent plan/discovery-map layout.

Traveler discovery keeps one question and its native choices in the main column, with an existing Palawan photograph alongside at desktop widths. The photograph drops away on smaller screens so choices and navigation use the reading space. A compact four-part line reflects the actual steps. The floating Bucketlist is hidden throughout this route; Back, Continue, Skip and recovery actions remain in document flow. This composition belongs to the discovery journey rather than the shared page shell.

Merchandise uses real product photography and an unframed split hero that stacks below (650px). Its collection grid changes from four columns to two below (1000px). This composition belongs to the merchandise surface brief; it does not prescribe other public heroes.

Studio uses a grouped rail beside a generous worktable: rail width (228px), narrowing to (204px) at (1200px) and below and widening to (248px) at (1750px) and above. Content uses its frontmatter maximum, desktop inline gutters (`clamp(24px, 3.3vw, 52px)`) and top/bottom padding (38px / 52px). A sticky contextual breadcrumb/date strip has minimum height (56px); brand, account and website utilities remain in the rail. The theme control is a compact sun/moon action at the strip's upper right. At (800px) and below, the rail becomes the canonical modal drawer, the strip becomes (60px) with a supported official mark and Menu action, the date is hidden, and content padding becomes (28px 20px 40px). At (600px) and below content padding is (24px 16px 36px).

The overview's source and focus order is the permitted Place library, administrator Merchandise library, task ledger/Create, then recent activity. Its desktop named grid places the ledger beside both libraries and journal; the merchandise layout stacks these groups at (900px) and below. Real published photographs form contact sheets, with actual product names and saved collection names in the Merchandise library; published/draft facts remain inline. These collection-desk choices belong to Admin Studio's surface brief; they do not redefine the public identity.

Shared tables own scrolling with layout/paint containment, a reserved scrollbar gutter, sticky desktop headers and maximum height (`min(68svh, 760px)`). Below (600px), labeled records retain a bounded (70svh) scroller and reserve at least (180px); desktop tables reserve at least (160px). Long Place and product editors stay in natural document flow, capped at (1120px), with section links/dividers and a sticky action bar. The table bound never becomes an editor-height constraint. MFA content remains capped at (560px) with internal gutters (24px).

**The Fixed Dock Rule.** Bucketlist/cart controls stay at the bottom-right viewport edge: 24px on desktop, 16px below 800px, with safe-area allowances. FloatingDock portals both controls to the body so page transforms cannot change their containing block. They never move or disappear in response to nearby page content. Shared CSS reserves final page clearance and scroll padding; map zoom controls clear the dock and failure text occupies its own row with the retry action on the left. Existing mobile field-focus, open-dialog and route exclusions remain; completing an action returns the dock to the same corner. Flights measure the actual dock, with a bottom-right transform origin for its brief confirmation pulse. This supersedes the former content-measured dock movement rule.

### Client PDF layouts — 24 October 2026

The public mobile menu is a left drawer, no wider than (340px / 86vw), with full viewport height, a backdrop and existing Modal focus behavior. It enters over (250ms) with `cubic-bezier(0.16, 1, 0.3, 1)`; reduced motion removes the entrance. Account links are direct within that drawer. Area/category return navigation reserves the sticky header height plus (24px), or (16px) on phones. Cookie consent uses the compact shared dialog, capped at (460px), with two equally prominent consent choices and Manage preferences.

The profile uses a (96px) avatar on desktop and (80px) at (600px) and below. Membership labels overlap it in the existing Explorer blue or Explorer+ gold. At phone widths the two header actions follow the identity in their own row; the traveler title stays compact and wraps. The dedicated planner browser uses horizontal category controls, a real destination-photo header, native filter fields and unframed (4:3) photo cards. Its three-column grid becomes two at (900px) and one below (380px); phone fields remain (16px). These are surface-specific measurements, not new global token ramps.

## Elevation & Depth

Tonal layers and thin borders carry most interface depth; photographs remain the dominant visual weight. The shared soft shadow belongs to dialogs and account disclosure. Preserve the retained photographic card hover treatment where present; do not generalize it into heavy chrome around operating surfaces. Map overlays describe real locations and never imply calculated routes.

### Shadow Vocabulary

- **Shared overlay:** `--p2-shadow` (`0 24px 80px #0007`) separates modal/account layers.
- **Travel thumbnail:** (`0 8px 20px #0005`) separates the temporary product flight from the page.
- **Public action hover:** (`0 3px 18px #83d9c614`) is restrained receiving emphasis, paired with a color change.

The native dialog backdrop uses a navy tint and blur (5px). These properties, unlike primitive frontmatter tokens, live in the sidecar's extensions and snippets.

## Shapes

Shared containers retain the default rounded shape; form controls, buttons, merchandise media and dialogs use their distinct frontmatter radii. Studio buttons/navigation use the compact control radius, fields use the separate input radius, and filter/table planes use the plane radius. Overview photographs use the media radius. These compact working shapes do not change public controls. The Bucketlist count, avatar and map stop marker are deliberate circular or capsule exceptions. Preserve original destination card and gallery silhouettes. The official palm-lock mark is an existing image asset, not a new icon construction.

## Components

### Foundational visual states

Enabled controls expose hover and visible keyboard focus. Public focus uses a teal outline (3px) with offset (4px); Studio uses theme gold (3px) with offset (3px). Selected tabs use fill plus pressed/current semantics. Disabled actions remain present and explain limits where needed. Save feedback follows storage confirmation. Inline errors persist beside their task; the global notice acknowledges success or failure. Loading uses text/status, never invented progress percentages.

### Buttons and actions

Teal is the primary safe action; outline is secondary. Public buttons use the frontmatter primary/quiet variants with minimum height (44px). Studio's main actions use their scoped variants and the same minimum target; compact table actions, pagination and sidebar utilities use (38px), navigation entries (43px), and section links/the phone Menu (40px). Destructive actions are separated and require an app-owned confirmation with the affected object. Icons use the existing SVG system, with accessible labels and delegated tooltips; Studio navigation adds a local (1.6px) stroked SVG vocabulary with visible text labels. Avoid placing floating controls over an active form.

### Cards / Containers

Featured Destination cards have no itinerary action; destination photo galleries have a focusable photo group outside the title link. Arrow keys and Home/End browse the existing gallery, with a swipe guard for pointer use. Product links and Add to bag forms stay separate; catalog and detail share the same validated variant/quantity behavior. The metadata gap uses the shared card gap; phone product metadata stacks for wrapping. Preserve actual photographs and product information.

### Navigation and data display

**The Browsing Navigation Rule.** The public brand header orders About, Membership, Merch, Contact Us, Itinerary Planner and Profile. Desktop Profile is a native disclosure with sign-in/register links for guests and the account menu for members; mobile exposes those account links directly in the left drawer. Native disclosure supports click, keyboard, Escape and outside dismissal. Area/category navigation retains the selected area. Real destination cards link to Places; protected save and itinerary controls remain separate actions. Merchandise has one floating cart with its browser-local count and no duplicate breadcrumb cart.

Admin uses the existing official palm-lock image in the rail, mobile contextual strip/drawer and MFA entry, with Outfit identity text. Both themes retain the navy rail. Overview is separate from the Content, Business and Workspace navigation groups, and module visibility follows existing roles. The active module has current-page semantics, a teal field and gold marker. Underlined module tabs use pressed semantics and retain their labels. Real photographs open their Place editor; task rows and Create precede recent activity in source order. Real counts and recent events support work without invented sales or charts. Tables retain semantic headers, labeled phone records and an accessible scroller. Loading, failed and loaded-empty states stay distinct with inline retry and image fallbacks.

### Forms and overlays

`ValidatedForm` and `validateFields` own accessible submit validation; retained fragment forms use the same helper. `SearchInput` owns clearing and composition-safe input. Native select/date controls are intentional: the supported browser/OS owns their popup geometry and calendar language. Dialogs/drawers use `Modal`, the browser top layer and body portal. `useDecision` supplies confirmations and text entry through that same primitive. Tooltips are placed inside an active dialog when needed and inherit the active admin scope.

### Motion

**The Confirmed Travel Rule.** Launch a Bucketlist plane only after the existing mutation confirms success; cart travel follows a validated browser-local addition. Flights decorate the actual state and counts, never manufacture them.

`travelFlight` owns both paths. The custom SVG plane uses the existing teal, off-white and gold; product travel uses the actual selected image and a visible photograph as its origin, falling back to the clicked control. Both follow a measured cubic Bézier over (800ms), sampled in (41) keyframes, with linear timing along the samples and shrinking scale. Plane rotation follows the curve tangent. The actual visible Bucketlist/cart control supplies the endpoint; the visible portion of a clipped source supplies its origin.

When a target is absent, hidden, offscreen or outside the active native dialog, use a local flourish (300ms). Reduced motion creates no traveling node and preserves real state, count and static receiving feedback. Decorative nodes are inaccessible, pointer-free and outside layout. There are at most (6) concurrent flights; completion, cancellation, navigation, viewport resize, page hiding and lifecycle unmount clean them up. A receiving pulse preserves the control's original transform; count feedback animates only the real displayed value (200ms). Avoid continuous animation in member/admin work and disable selection transitions under reduced motion.

Studio's module/editor wrapper arrives once over (240ms) with visible-default opacity (0.7 → 1); its heading settles vertically by (6px) using `cubic-bezier(0.16, 1, 0.3, 1)`. Filter changes do not remount this wrapper. Hover/focus expands only a Place photograph to (1.045) over (500ms) and moves its arrow (2px) over (250ms); section and ledger arrows move (3px) over (150–160ms). Buttons transition foreground, background and border over (150ms); rail states use (160ms). Reduced motion removes both arrivals and makes Studio/drawer transitions immediate. Content remains readable before animation starts, and long editors retain normal scrolling.

### Traveler preferences and identity

Selectable interest and preference tiles retain native checkbox/radio semantics within the shared form. Navy panels, teal borders and raised selected surfaces carry state; a check or radio mark makes selection visible beyond color. Keyboard focus uses the existing gold accent. Back and Continue preserve answers; saving disables affected choices while errors retain the draft. The result uses an existing category icon and one short arrival, absent under reduced motion.

**The Consented Identity Rule.** Public traveler badges appear only after explicit sharing consent. A teal traveler-type badge leads up to two muted interest badges; private answers remain in the owner's account. Badge groups wrap naturally and keep readable labels. The account sharing checkbox shows its pending choice while disabled, announces saving, and restores the confirmed choice on failure.

The account identity and invitation use thin section boundaries rather than a new dashboard shell. Admin traveler insights inherit the active Studio theme and show aggregate counts with a native disclosure for the supported mapping. These feature treatments do not add global type or radius tokens.

### Browsing and editor expansion

Profile navigation uses a circular photograph when available and a drawn person icon otherwise, with an accessible Profile name and no visible text label; the left drawer has direct account links.

**The Branded Auth Rule.** The sign-in, register and recovery forms share a branded navy form surface with the official palm-lock mark, Outfit headings, Open Sans fields and the established teal links. Field and autofill text use --p2-text. Password visibility is an inset eye icon with an accessible action name. Registration includes confirmation and a visible twelve-character minimum; both the form and server validate matching passwords.

The admin merchandise list always exposes a native Collection filter, including when one collection exists. Its selected value belongs to the list URL. The planner's dedicated browser now replaces the former miniature area/category discovery map; the homepage map and selected-day My route remain. Search, area, category, transport, duration and sorting belong to the browser query with the owned trip/day. Confirmed additions remain visible as Added to itinerary, and the existing time dialog is retained. The browser has itinerary actions only and no floating Bucketlist. Membership-filtered inventory remains authoritative.

The homepage merchandise preview follows Featured Destinations, with three visible products on desktop, a partially visible next product on phones, explicit previous/next buttons, touch scrolling and a View all merch link. Cards show actual catalog photographs, names and PHP prices; they open product details. Native overflow remains keyboard accessible and respects reduced motion. Merchandise routes have one shared floating cart; the upper breadcrumb does not duplicate it. Public Brand and Category selects align with search in one row, scrolling on phones. Collections are named sections, with Unlock Paradise Collection first; admin retains its Collection select. Shared tooltips use phase2.css dock tokens: surface #133842, foreground inherited from the public text token, and accent inherited from the public teal token, independent of the admin theme adapter.

**The Product Selection Rule.** Brand → Collection → Products is the durable catalog hierarchy. Admin selects existing categories, colors, sizes, brands and collections; an adjacent inline Add action creates a reusable option without leaving the product form. The product editor groups Product details, Photos, Options & pricing, Advanced and Publish in document flow. Photos belong to the current editor: upload/add, preview, make cover, reorder, replace and remove. There is no cross-product media picker. Upload feedback stays inline, successful partial uploads remain attached, and save is disabled while uploading. Slugs and SKUs are suggested but editable.

**The Access Point Rule.** Multiple verified access points remain separate from destination coordinates and protected by Place membership rules. Teal square pins and transport icons distinguish them from the gold destination pin. Marker names appear on hover, keyboard focus or touch selection, with an accessible name always available. Text access lists survive map failure; their named Maps actions use each access point, while the Destination section owns destination coordinates, copy and its own Maps action. Raw coordinates are omitted from the jump-off list. Place area/category/facility selection retains native add-option controls with removable selected values; access colors remain owned by --p2-teal and --p2-on-teal.

### Client review components — 24 October 2026

**The Dedicated Discovery Rule.** Explore options opens `/itineraries/explore/` with the selected owned trip/day. Categories, filters and photographic cards stay in normal page flow, with a prominent View final itinerary return action. My route remains the saved-stop map. Additions become Added only after the owner/version-checked mutation returns; failed additions retain the form and offer reload of the saved itinerary.

**The Public Preview Rule.** Published premium cover previews are deliberately bounded, re-encoded images addressed by opaque Place ID. Only explicit editorial Featured cards disclose a premium title; other locked cards retain generic text. Compact destination and feature hooks use the official padlock identity and task-specific copy. Upgrade opens Membership with a safe return target; Back uses a normalized internal browsing target or the homepage map.

Edit profile groups Display name, Profile photo and Travel preferences inside the canonical scrolling Modal. Each section confirms its own save, while one mutation lock covers name, preferences, photo upload and removal. Pending work protects close; dirty work uses the shared discard decision. Failed fields retain drafts with scoped feedback, and Reload saved preferences requires an explicit discard choice. Public badge sharing stays in Account settings.

The visual description editor uses ordinary editable text with Paragraph, Heading, Bold, lists, links and undo/redo controls. Its (15px / 1.7) text and bounded (240–600px) reading region are scoped to Studio; focus and surfaces inherit the active theme. Advanced HTML remains available, supported old content stays intact until edited, and server sanitization remains authoritative. Plain journey fields render the existing road/boat timeline. The Merchandise library reuses real product photographs, names, collection relation and existing editor/library actions, including loading, empty, failure/retry and image fallback states. The header theme action retains its accessible label, tooltip and persisted theme.

Print and downloaded HTML use the official mark, trip title/dates, all saved stops/times/notes, and a branded footer. The offline document embeds the mark and uses local system text so it needs no remote assets; that export-only fallback does not change application fonts. Existing print break rules are implementation, with long-entry pagination still awaiting visual release verification.

**The Inclusive Trip Rule.** Trip creation uses start/end dates and an inclusive derived duration. An undated new trip starts with one day. Add day remains in the planner and extends a dated trip’s end date; occupied days cannot be removed by shortening dates. Profile/navigation, photos and native choices retain the shared validation, focus and theme contracts.

### Content

Use Place, Bucketlist, Portfolio and Itinerary consistently. Portfolio is the single collection of visited destinations; do not add a separate Visited Places section. Keep factual descriptions, warnings, fees, source links and credits. Unknown durations are “unspecified.” Curated recommendations need actual published relationships. Merchandise ordering remains visibly unavailable until a commerce backend is provided. Bag additions and browsing activity are not sales.

## Do's and Don'ts

### Do:

- **Do** keep the map, real photography and official palm-lock identity central to discovery.
- **Do** reuse the shared state, form, tooltip, modal, card and travel owners across screens.
- **Do** keep admin themes scoped and propagate the chosen theme through portals and native controls.
- **Do** preserve membership, variant, quantity and owner isolation at their authoritative boundaries.
- **Do** preserve visible text and control geometry throughout navigation and saves.

### Don't:

- **Don't** replace the established public palette or fonts while extending admin or merchandise.
- **Don't** turn legacy generic travel time into a boat or hike duration.
- **Don't** claim purchases, saves or plans succeeded before their real storage confirms them.
- **Don't** aim decorative travel at a hardcoded viewport corner or cover active controls with a floating dock.
- **Don't** turn inherited decorative eyebrows or glyph placeholders into reusable system rules.

Not canonized: legacy decorative uppercase eyebrow treatments and any inherited glyph placeholders remain pre-existing craft-floor drift outside this documentation-only boundary. Their presence in source does not authorize copying them into new surfaces; no runtime repair is made here.

## Member planning refinement — 22 October 2026

The 24 October Studio redesign retains the 23 October consolidation of branding, account and website access in its left navigation; the client PDF subsequently moves the theme action to the content header. A contextual breadcrumb/date strip precedes the task heading; it contains no second desktop brand or account utility row. Mobile uses its supported official mark, location and Menu action. Shared headings, filters, pagination and row hover states use the existing Studio tokens and scoped layout owner. Portfolio and Bucketlist share the saved-Places page layout, selected tabs, search/filter controls and empty-result panel. Portfolio reads visited records and its removal action only clears visited status.

Merchandise editing keeps Card highlight beside the product selections, with visible Details & care and optional Size guide sections. Native size choices and compact measurement rows use Studio tokens; measurements remain in inches. Collection taglines are optional muted body text directly below collection headings, editable through the existing inline catalog-choice owner. At phone widths, the planner uses compact 44px controls, horizontally scrollable day tabs, a smaller trip heading and a single aligned map-mode row. Selected-day and map-mode contrast remain unchanged.

Preserve the existing public palette and fonts. Selected planner days use a filled teal button, dark text and an explicit Selected label. Optional visit times use native paired time fields, the shared validation/form owner and existing modal/disclosure patterns. Checkout places its introduction beside one payment panel with selected period rows and a live total; profile places membership and traveler preferences beside destination previews and settings. Both stack on mobile. Runtime ownership remains phase2.css; behavior and verification boundaries are recorded in UX-CONTRACT.md.

## Place discovery refinement — 22 October 2026

Place editing uses a normal-flow worktable with direct section links, searchable native traveler checkboxes and ordered nearby rows. Section spacing and thin dividers replace nested cards; existing Studio tokens own both themes. Public nearby recommendations use compact photo-and-text rows, visible Google attribution and a Maps action. Text-only rows remain complete without photography. Touched admin, checkout and destination guidance uses direct task language, with redundant promotional eyebrows removed. The existing palette, type families and shared interaction owners remain unchanged.

## Approved member identity and map system — 22 October 2026

This refinement supersedes the earlier profile-header, planner preview placement and free itinerary rules. Runtime CSS remains canonical in phase2.css. Membership Explorer uses --membership-explorer (#78b5f5); Explorer+ uses --membership-plus, an alias of the existing membership-plan --upd-vip-gold (#d4a344). Tier text and the label overlapping the avatar use those same tokens, separate from the teal traveler identity.

The header places the avatar beside the name and interest-specific linework emblem. Each of the 63 interest masks creates a distinct geometric SVG composition; water, coast, mountain, local landmark, food and coffee layers have confined motion. Likes lists the actual selected interests. The public-review consent control belongs in Settings → Privacy and keeps existing consent/version behavior. Reduced motion removes emblem animation; offscreen and hidden documents pause it.

The right-map-card discovery recorded in this refinement is superseded by the dedicated photographic browser in Client review components above. Final itinerary/My route retain filled-teal selected states; route bounds still fit the saved stops.

A shared FeatureLock owns the branded padlock screen for Bucketlist, Portfolio, Itinerary Planner and hidden destinations. Premium teasers use generic lock artwork, never Coming soon.

Emblem-only accents remain scoped in phase2.css: mountain linework #b8d5df, culture/food #e4c78d and coffee #e0b89c. They distinguish the motif geometry within the shared teal outline and do not replace public action or membership tokens.

## Traveler lettering — 23 October 2026

TravelerTitle owns the expressive title treatment in the profile and survey result. Its scoped tokens in traveler.css are canonical; all surrounding navigation, controls and body copy retain Outfit/Open Sans. Three locally hosted Latin font subsets (about 68 KB combined, with licenses in public/fonts/traveler/) give the title its own voice: Satisfy for coast, rivers and coffee, Barlow Condensed 600 for alpine/wildcard names, and Cormorant Garamond 600 for culture and food.

The six nameplate palettes use surface / text / atmosphere tokens: coast #133039 / #b8eddb / #7bcdb9; rivers #142d42 / #bce1fb / #75b9e2; alpine #20332f / #d5e5d0 / #9cc7aa; culture #342c26 / #f0d7a3 / #c8aa6f; food #36271f / #f3d7b6 / #d4a57e; coffee #302725 / #efcdb9 / #c49b81. Wildcard uses #1b3035 / #e8dbb5 / #a2c8bb. Ordinary combined identities inherit the first normalized interest's lettering/palette and combine up to three selected atmosphere layers; all six use the wildcard treatment. Identity names and classification remain unchanged.

Confined geometric backgrounds carry tides, currents, alpine contours, heritage ornament, table rings and coffee steam. Title lettering drifts at most 1.5px or softly changes ink opacity over 9 seconds; backgrounds take 10–18 seconds. useAmbientMotion owns both emblem and title lifecycle: visible-only, no hidden-document playback, and a static reduced-motion alternative. The title remains real selectable text; decorative SVG is hidden from accessibility APIs. On mobile, the identity occupies its own full-width header row so long titles wrap naturally. Public-review badges remain compact and static.

The subsequent icon reversion restores the original shared Icon glyphs in profiles, survey results and public badges, replacing the composed hexagonal emblems. The animated TravelerTitle lettering, backgrounds, palettes and fonts remain. Archetypes continue to select their original icon; this supersedes the earlier emblem requirement for these surfaces.

The title nameplate itself also idles over 10 seconds: a 2px vertical drift and a themed border tint varying from 27% to 44% accent. It does not change layout or animate the separate icon. The existing visibility/reduced-motion lifecycle governs the plate together with its lettering and atmosphere.

Nameplates are compact labels: 20–24px display lettering on desktop, 20px on phones, 40px/36px minimum heights, 6px 12px 8px / 5px 10px 7px padding, 8px corners and 28px static glyphs. They wrap long names naturally rather than imposing a fixed height. Existing colors, type families and ambient motion remain.

The profile subsequently removes its separate traveler glyph; review badges and survey results keep their existing icons. The header's View map action links to /#palawan-map, sits at the right edge on desktop, and remains full width on phones. Itinerary stop times sit at the right of the destination heading in the same 18px heading face, with smaller duration text and the existing inline time editor. At phone widths the right-aligned time follows the destination above the move controls. Stop notes use an always-visible textarea and Save note action, with the existing persistence and unsaved-change guards.

## Task feedback and trip preparation — 24 October 2026

Authentication additions retain the compact navy AuthForm, Outfit headings and existing field geometry. The explicit Google button follows its neutral white brand treatment with a multicolor G; the email form and its submit action precede Google, separated by a quiet divider. The client PDF subsequently replaces the first-visit banner with the compact shared cookie dialog described in Layout; the owner subsequently removed the separate footer Privacy preferences button and its spacing; Manage preferences remains within the initial cookie dialog. The dock follows the Fixed Dock Rule. No ambient animation or new visual system is introduced for authentication or privacy.

Shared StudioTable owns loading skeletons, loaded-empty and failed states via StudioDataState; stale request keys cannot paint an old result or clamp a new filter's page. Loading geometry reserves three rows without ambient animation. Readable activity verbs and entity names replace database identifiers in the studio.

Saved-place pages retain their shared header and tabs but omit filters when there are no records. Phone headers use compact spacing and a 44px planner link. Daily itinerary timelines use the existing type, teal time labels and gold overlap warnings; no estimated journey time is invented. The browser print view is a plain, high-contrast, all-days document with saved notes and Palawan-local times, portaled beside the application so other chrome does not print.

Merchandise calls its local selection a cart throughout. Product editor previews reuse the actual collection-card and detail components with purchase actions, navigation and analytics disabled. The readiness checklist is advisory, with inventory uncertainty explicitly stated; publishing and ordering permissions are unchanged. MapFeedback owns bounded loading, failure and retry feedback in both area and destination maps, and the selected destination pin has a persistent gold/teal state. ContentImage provides a reserved, readable fallback when a cover or destination photo cannot load.

## Client planner refinement — 24 October 2026

The planner retains the public navy, teal, sand/gold, Outfit and Open Sans system. One selected-day work surface replaces simultaneous desktop columns. Final itinerary and My route use the existing filled-teal selected control at every width. Destination cards retain real photos and a static gold sequence marker, with the timing on the right, a small upper-right three-line actions disclosure and a Notes disclosure. Search and map discovery sit behind two explicitly named Add destination choices. The cards use existing rounded media/control geometry and thin slate boundaries; an open action panel lifts its owning card above its neighbors. Hold-to-drag feedback is direct manipulation rather than an idle animation. At phone widths card content stacks and wraps without reducing supporting metadata below 11px; the shared 44px action targets remain.

## Area-scoped planner refinement — 25 October 2026

Keep the incumbent navy/teal/gold and Outfit/Open Sans system. A native single-area field anchors each new trip. The photographic Explore browser retains category tabs, accessible hover/focus contrast and one trip area; native day selectors sit in its toolbar and add dialog. Photo stop cards precede the timeline. The compact inline finder is search-only, and Route stops sits 8px inside the map's upper-left edge below any measured recovery notice.

Profile statistics use two equal columns: Bucketlisted and In Portfolio; the editor offers photo upload/replacement only. Getting there uses inline access-type and destination Maps links without coordinate text. Cookie choices say Accept cookies and No thanks. The About shoreline photograph crops spare sky near the mountain ridge and fades at the top/bottom into its existing sea background. Responsive delivery preserves originals and the same framing.

The itinerary destination browser uses the same white Places cards as regular browsing, retaining the shared 4:3 photo, dark title, travel-time and teal transport metadata, with its itinerary action over the photograph. The phone grid is one column. The canonical title selector also supports section-level headings inside the planner shell.

## Approved UX polish — 25 October 2026

The scalar frontmatter font sizes describe the existing desktop ceilings. Runtime fluid sizes remain display `clamp(44px, 5vw, 72px)`, headline `clamp(32px, 4vw, 56px)`, editorial `clamp(26px, 3vw, 38px)` and studio heading `clamp(30px, 3vw, 40px)` in their established CSS owners; this representation keeps the machine-readable dimension schema valid without changing those styles.

Scope is the owner's accepted items 2–8. The homepage's main map/Start exploring CTA retains its current wording, placement and behavior. Keep the incumbent navy, teal, gold, Outfit/Open Sans and canonical white Places cards.

On phones, the destination browser uses a compact photographic heading and day/return toolbar. Search and categories remain directly available; transport, duration and sort use a single Filters disclosure with removable active-filter chips. Desktop retains the full filter row. Loading uses static, reserved card skeletons and a readable status; avoid shimmer or invented destination information.

Trip-title feedback distinguishes Saving changes, Saved, unsaved drafts and failed saves. Failed requests retain their draft and offer Retry save; version conflicts require reloading the saved plan. Delete trip is a labeled danger action inside Trip options and retains the existing confirmation. Stop, Bucketlist and cart removals use the shared Undo notification. Itinerary Undo restores the saved day, position, notes and visit time through a versioned server transaction. Notifications pause dismissal during interaction and keep failed Undo available for retry.

The phone merchandise introduction keeps its real image alongside smaller text so products appear sooner. Product actions state that ordering opens soon. Cart and membership payment capabilities retain their existing boundaries.

Place cover/gallery and product photo editors use one shared focal-point disclosure: choose on the uncropped image, adjust with arrows or Home, inspect a card preview, and reset to center. The selected crop is metadata, never a rewritten original. Retained images keep their crop through older-client saves. Public, protected, planner and preview images honor that metadata through their existing delivery and access paths.

## Client photo and hook correction — 25 October 2026

This supersedes the earlier removal of homepage category icons. Restore the original six icon/label items as informational spans: hover/focus gives the current count, with no link or click action. The main Start exploring/map CTA is unchanged.

Destination access hooks are photographic: the authorized cover preview, concise account requirement and the existing Guest/Explorer/Explorer+ comparison. Feature hooks retain the padlock treatment. Both omit the redundant in-content logo; the shared site header remains. Premium destination names, originals and guides keep their existing restrictions.

Category tiles eagerly request their bounded image sizes before the map overlay opens. If an association is hidden from the viewer, use the established public category thumbnail rather than a blank tile. Featured photographs use real image elements in a 4:3 frame with cover fitting, filling the card edge to edge without side bars. Admin focal points control the crop. This replaces both the short fixed-height background crop and the subsequently rejected contain framing. Storage delivery remains proportional so CSS crops a correctly scaled source. Bounded public previews preserve photo composition by default and apply explicit focal cropping when selected. React images and retained HTML each have one canonical retry-to-original adapter, then a readable unavailable state. Original assets remain intact.

## Planner and profile refinements — 25 October 2026

The selected day has three views: Itinerary for photo cards and editing, Schedule for timed and flexible visits, and My route for its map. The shared Add destination card sits below every view with Search destination and Explore options. Notes remain visible with a small inline icon. Reordering gives each destination its new position’s saved time slot; destination notes stay attached. Cross-day moves append and retain that visit’s time.

Explore options retains the normal white Places cards. Category tabs omit All destinations. The standard transport, assets, Explorer+ and name/date/rating filters remain; search and travel-time filters are absent here. Bucketlist controls share the normal Places mutation/Undo behavior, including inline search results. Return preserves the source URL, filters, displayed result count and clicked position; Back to categories reopens the correct home map area.

The mobile drawer leads with the account photo/name, followed by primary links, Itinerary Planner, My Portfolio and Log out. Bucketlist stays in the floating companion and account page. Profile collections swipe horizontally on phones with snap points and keyboard/previous/next alternatives. The selected featured place has a visible photo and selected star. Its red delete icon sits in the photo's upper-right corner on an opaque navy 44px control, revealed by hover or keyboard focus and always available on touch screens. Discount/savings claims are hidden; prices remain unchanged.

## Visit-time compatibility — 26 October 2026

The shared Visit time control uses platform-native Hour, Minute and AM/PM selects for both start and end. Native segmented time inputs are replaced across adding, exploring and editing destinations. Choosing an hour creates a complete HH:mm value with minutes defaulting to 00; minute and AM/PM selectors become available then. All 60 minute values, midnight/noon, paired optionality, same-day end-after-start validation, clear-to-flexible, draft protection and saved-time behavior remain. The popup remains OS-owned under the existing native Select ownership. No browser sniffing, custom popup, stored-time conversion or server migration is introduced.

## Client plan composition - 26 October 2026

This approval supersedes the left public drawer, selected-day-only Schedule, toggled/duplicated inline search, planner filter disclosure and profile shortcuts. Keep the navy/teal/gold identity and existing type. The planner toolbar uses joined transport controls, a quiet native sort and a second line containing the Explorer+ pill and reset. Phone controls wrap with readable targets. The add card exposes a single SearchInput beside Explore options, with results below. The trip-level view switch precedes the day-specific controls; Schedule groups every day.

Day-tab delete controls are sibling buttons, revealed on hover/focus and visible on touch; disabled final-day/draft states remain explained. Their red icon uses phase2.css public error tokens: --p2-error maps the existing studio-dark-danger value to navy surfaces, and --p2-error-on-teal maps studio-light-danger to selected teal tabs. Profile content participates in the shared workspace grid, with one membership region positioned in the desktop sidebar and preceding Settings in mobile document order. FeatureLock alone uses the compact gold-bordered 350px card, 58px lock, 25px title and Back outside it; DestinationGate remains photographic. Normal Places and planner cards share 4:3 media geometry, a minimum 158px white body and reserved two-line title space, including protected/absent metadata. Existing focal points still own visual cropping.

Runtime owners: client-todo.css for these named compositions; phase2.css and retained theme tokens continue to own the palette, type, focus and shared foundations. The right-side public menu retains Modal behavior. Home streams featured/merch content independently so category return need not wait for unrelated sections; the map initializes its category panel directly from the validated area query.

## Itinerary library — 27 October 2026

My itineraries is an Operate surface owned by itinerary-library.tsx and its namespaced client-todo.css rules. Its compact Outfit heading, navy page, teal primary action and 4:3 photographs continue the Places visual language. Three desktop columns become two at 1100px and one at 640px. White card bodies carry navy trip names and readable muted metadata; the whole card is one native navigation link, with no nested action or duplicate deletion affordance. The subtitle is Organize your trips here. The client-approved 29 October refinement removes the search, area and sort toolbar. Existing ContentImage, TripForm, Modal, notification and BrowsingTrail owners supply behavior. Loading/status and counts remain for populated results; failed loading never claims an empty collection. The editor's compact My itineraries return replaces the trip dropdown and uses the existing discard confirmation.

The empty library follows the client's reference: a single tinted navy/teal panel with an inset dashed border, a crisp folded-map/pin icon, No itineraries yet, and Plan and save your trips here so you can easily access them anytime. Its only create action is an outlined teal Add itinerary pill inside the panel; no duplicate header action or zero-count row is shown. Keep the compact mobile scale and a 48px action target. Populated libraries keep Add itinerary in the header and pagination below the cards. Native stop Notes still wait for client readiness before accepting edits, preventing an early WebKit edit from appearing without being tracked.

Saved itinerary cards use compact text bodies: 16px/18px padding on desktop and 12px/14px on phones, natural title height, and tight title/date/count/open-action gaps. Keep their 4:3 photographs, readable metadata and whole-card navigation. This density refinement applies to populated cards; the approved empty-state panel retains its original proportions.

## Destination-photo crossfades and profile spacing — 27 October 2026

ItineraryLibraryCard owns the bounded destination-photo preview, replacing image hover zoom with a 450ms opacity crossfade every two seconds. The prior frame remains opaque beneath the incoming frame to avoid a dark flash. Responsive ContentImage delivery and fixed 4:3 geometry remain. The user-requested preview has no Pause/Resume overlay. Offscreen, hidden, inert and keyboard-focused previews stop; reduced motion shows a still and omits autoplay controls. Only current/next/outgoing photos mount.

## Image delivery performance — 27 October 2026

Preserve the incumbent palette, proportions, focal points and card crops. ContentImage uses ready stored sizes, not Supabase runtime transformations; immutable local merch copies use the generated merch-images manifest. Original image files remain available privately or at their existing local paths. Only visible, motion-eligible itinerary cards mount the next photo. Preload the established body/display fonts; reserve a full content viewport during route loading so the footer does not jump through the first screen. Main-map initialization is proximity driven while compact maps retain immediate behavior. Admin upload controls retain the same form anatomy, show phase progress and permit cancelling the transfer before processing; edits remain locked during an upload. Never describe a compressed display copy as a lossless archival original.

Namespaced client-todo.css rules supply planner search's 46px icon clearance, phone stacking and account workspace/stat/membership divider spacing. Account settings joins the sidebar as an in-page shortcut. React-owned profile password inputs use PasswordField instead of imperative reparenting; static markup keeps SiteBehavior's adapter.

## Homepage first paint — 27 October 2026

The hero renders before destination/map queries. Its existing 16:9 photo remains a full-bleed cover with the same parallax layer and crop. Responsive sizes account for the layer's 130% height and the 88svh phone/78vh desktop hero, rather than requesting a blurry phone-width image for a tall cover. It is eager and high priority; originals remain unchanged. The home header declares its overlay state in initial HTML, and the streamed map reserves its final 90lvh geometry. Non-clickable category icons initially announce their category, then receive live counts without moving visible content. Do not show fabricated zero counts while data is loading.

Browse returns retain the existing page composition and restore before paint. Cached app navigation shows the destination list directly at its saved card. A cold document return uses a fixed, plain returning status in the existing muted color while the original page geometry is reserved, then reveals the correct position without a fade or animated scroll. The status is absent on normal first visits and has an eight-second failsafe. No new navigation shell or modal destination design is introduced.

## Mobile app density — 28 October 2026

`src/app/mobile-app.css` owns the public app's compact phone/tablet scale after the legacy styles. At 800px and below, use 24px page titles, 20px trip titles/sections, 16px subheadings/stop titles/times and 14px body copy. App controls use sentence case at 13px; the drawer uses 14px links through its existing 921px breakpoint. Public category/destination titles use 26px and the About introduction uses 28px. Preserve the existing fonts, navy/teal/gold palette, selected states and 4:3 destination photographs. The non-home app header is 64px high; 16px gutters and shorter section gaps bring useful content higher on the screen. Login, registration, membership, contact and legal pages share this compact scale and header clearance. The cinematic homepage opening retains its own proportions.

Smaller labels do not mean smaller hit areas: actions and menu rows remain at least 44px high, and native text entry stays 16px to avoid iPhone focus zoom. Stop numbers remain noninteractive. Public modal typography follows the app scale; Admin Studio retains its own design system.


### Image delivery refinement — 29 October 2026

Preserve the existing image boxes, focal crops and card hierarchy. Keep full responsive candidates on high-density screens, bound thumbnail/detail downloads to their actual layout, and account for portrait map tiles. The homepage hero and map category photographs use prepared public assets with immutable paths; the full-size hero retains its exact native source bytes. No visual upscaling or new crop design is introduced. Product photos with insufficient source detail require a better original rather than artificial enlargement.


### Navigation and map control consistency — 29 October 2026

Current-page feedback uses the existing teal and restrained underlining in mobile/account navigation. Map provider attribution uses the existing cream foreground token as an opaque surface with dark text, preserving legibility over photography. Provider controls and phone admin actions retain 44px touch areas. Auth password visibility reuses the established shared eye icon and field geometry.

### Public preview sharpness — 30 October 2026

Published cover previews use the shared 256/384/640/1080/1920px candidates and the smallest adequate ready display file within the parent's storage bucket. The versioned stored derivative preserves proportional composition and explicit focal metadata, includes its requested width in the cache identity, and never enlarges a small source. The endpoint rechecks publication and the current cover before cached or conditional responses. It does not disclose an archive, private object path, original redirect or protected title. No Supabase runtime transformation is introduced. A low-resolution original requires a replacement photograph; larger CSS boxes or artificial enlargement cannot restore missing detail.
