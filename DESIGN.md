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
  studio-dark-strong: "#a3e8d8"
  studio-dark-danger: "#ffb4a9"
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
typography:
  sans:
    fontFamily: "Open Sans, sans-serif"
  headings:
    fontFamily: "Outfit, Quicksand, sans-serif"
    fontWeight: 500
  display:
    fontFamily: "Outfit, Quicksand, sans-serif"
    fontSize: "clamp(44px, 5vw, 72px)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Outfit, Quicksand, sans-serif"
    fontSize: "clamp(32px, 4vw, 56px)"
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
    fontSize: "clamp(26px, 3vw, 38px)"
    fontWeight: 500
    lineHeight: 1.2
  studio-heading:
    fontFamily: "Outfit, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  studio-body:
    fontFamily: "Open Sans, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
rounded:
  DEFAULT: "16px"
  control: "8px"
  button: "10px"
  studio-control: "7px"
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
    rounded: "{rounded.studio-control}"
    padding: "9px 14px"
  studio-button-light:
    backgroundColor: "{colors.studio-light-teal}"
    textColor: "{colors.studio-light-surface}"
    rounded: "{rounded.studio-control}"
    padding: "9px 14px"
  studio-input-light:
    backgroundColor: "{colors.studio-light-surface}"
    textColor: "{colors.studio-light-ink}"
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

Runtime CSS remains canonical (Model B). `src/app/phase2.css` owns `--p2-*`; `public/original/wp-content/themes/unlock-paradise/assets/css/tokens.css` owns retained `--upd-*`; `src/app/admin/admin.css` owns `--studio-*` and its scoped shared-component adapter. This file mirrors accepted source values rather than generating runtime styles. The sidecar adds preview snippets, motion, depth and breakpoint metadata; its generated tonal ramps are preview aids, not additional runtime palette tokens.

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
- **Studio rail and rail text** (`studio-nav`, `studio-nav-text`): the same navy identity frame in both admin themes.
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
- **Admin:** Studio uses its heading and body roles. Section headings are (22px); third-level headings (18px); table labels and supporting text (13px). Supporting data does not inherit the public display scale.
- **Editorial:** destination editorial headings use the editorial role; quoted prose uses Georgia (20px / 1.6).

Use tabular numerals for amounts and record counts. Preserve existing contextual metadata without adopting decorative uppercase eyebrows as a reusable typography role.

**The One Heading Family Rule.** New store and admin headings inherit Outfit from their shared owner; Georgia stays with the established destination editorial material.

## Layout

New public pages use the frontmatter page measure and gutters, with phone gutters at (800px) and below. The desktop shell begins with the section gap; phone top padding is (32px). It reserves bottom room (100px). Dialog bodies scroll within the visual viewport. Content and errors remain reachable at short heights and increased text size.

**The Shared Card Anatomy Rule.** Use the shared inset, compact and gap tokens for card content. Destination bodies and featured card bodies use the shared inset; Featured Destination cards navigate to the Place and do not offer an itinerary action. Product text and purchase controls are separate semantic siblings; names wrap naturally. The compact step is part of the authored scale, not a blanket override of every card.

Account uses the full page frame with a responsive destination grid and disclosure settings. The planner has adjacent plan and map panels on desktop; phones switch between Day plan and Map. Its compact top toolbar contains the workspace name, native trip switcher and New trip action. The selected trip title, readable dates, day tabs, stops and map follow directly. New trip uses the shared modal over an existing plan; first-time creation is inline. The shared destination finder stays inline, with stable area/category choices, search, map mode and explicit main-map navigation.

Traveler discovery keeps one question and its native choices in the main column, with an existing Palawan photograph alongside at desktop widths. The photograph drops away on smaller screens so choices and navigation use the reading space. A compact four-part line reflects the actual steps. The floating Bucketlist is hidden throughout this route; Back, Continue, Skip and recovery actions remain in document flow. This composition belongs to the discovery journey rather than the shared page shell.

Merchandise uses real product photography and an unframed split hero that stacks below (650px). Its collection grid changes from four columns to two below (1000px). This composition belongs to the merchandise surface brief; it does not prescribe other public heroes.

Studio uses a rail beside a generous worktable: rail width (224px), content maximum (1580px), desktop content gutters (36px). At (1100px) the rail narrows to (192px); below (800px) navigation moves to the shared drawer and content uses phone gutters. Above (1700px) the rail is (240px) and content gutters (54px). Overview puts shortcuts ahead of attention items in DOM and visual order. Table records own wide-content overflow and stack with explicit labels below (600px). Editor forms stay in normal document flow. MFA content is capped at (560px) with internal gutters (24px).

**The Fixed Dock Rule — 23 October 2026.** Bucketlist/cart controls stay at the bottom-right viewport edge: 24px on desktop, 16px below 800px, with safe-area allowances. FloatingDock portals both controls to the body so page transforms cannot change their containing block. They never move or disappear in response to nearby page content. Shared CSS reserves a final page clearance and scroll padding for reachable end-of-page controls. Existing mobile field-focus and open-dialog visibility rules remain; completing an action returns the dock to the same corner. Flights measure the actual dock, with a bottom-right transform origin for its brief confirmation pulse.

## Elevation & Depth

Tonal layers and thin borders carry most interface depth; photographs remain the dominant visual weight. The shared soft shadow belongs to dialogs and account disclosure. Preserve the retained photographic card hover treatment where present; do not generalize it into heavy chrome around operating surfaces. Map overlays describe real locations and never imply calculated routes.

### Shadow Vocabulary

- **Shared overlay:** `--p2-shadow` (`0 24px 80px #0007`) separates modal/account layers.
- **Travel thumbnail:** (`0 8px 20px #0005`) separates the temporary product flight from the page.
- **Public action hover:** (`0 3px 18px #83d9c614`) is restrained receiving emphasis, paired with a color change.

The native dialog backdrop uses a navy tint and blur (5px). These properties, unlike primitive frontmatter tokens, live in the sidecar's extensions and snippets.

## Shapes

Shared containers retain the default rounded shape; form controls, buttons, merchandise media and dialogs use their distinct frontmatter radii. Studio controls use their compact radius rather than inheriting the public button shape. The Bucketlist count, avatar and map stop marker are deliberate circular or capsule exceptions. Preserve original destination card and gallery silhouettes. The official palm-lock mark is an existing image asset, not a new icon construction.

## Components

### Foundational visual states

Enabled controls expose hover and visible keyboard focus. Public focus uses a teal outline (3px) with offset (4px); Studio uses theme gold (3px) with offset (3px). Selected tabs use fill plus pressed/current semantics. Disabled actions remain present and explain limits where needed. Save feedback follows storage confirmation. Inline errors persist beside their task; the global notice acknowledges success or failure. Loading uses text/status, never invented progress percentages.

### Buttons and actions

Teal is the primary safe action; outline is secondary. Public buttons use the frontmatter primary/quiet variants with minimum height (44px). Studio buttons use their scoped variants and the same minimum target. Destructive actions are separated and require an app-owned confirmation with the affected object. Icons use the existing SVG system, with accessible labels and delegated tooltips. Avoid placing floating controls over an active form.

### Cards / Containers

Featured Destination cards have no itinerary action; destination photo galleries have a focusable photo group outside the title link. Arrow keys and Home/End browse the existing gallery, with a swipe guard for pointer use. Product links and Add to bag forms stay separate; catalog and detail share the same validated variant/quantity behavior. The metadata gap uses the shared card gap; phone product metadata stacks for wrapping. Preserve actual photographs and product information.

### Navigation and data display

The public brand header orders About, Membership, Merch, Contact Us, Itinerary Planner and Profile. Profile is a native disclosure with sign-in/register links for guests and the account menu for members. Native disclosure supports click, keyboard, Escape and outside dismissal. Mobile navigation uses the shared drawer. Real destination cards link to Places; save, visited and itinerary controls are separate actions. On merchandise routes, the shared floating control opens the cart and reflects its browser-local count.

Admin uses the existing official palm-lock image in the rail, mobile header/drawer and MFA entry, with Outfit identity text. Both themes retain the navy rail. Studio shortcuts and actionable rows precede attention details; real counts and recent events support work without invented sales or charts. Tables retain semantic headers, labeled phone records and an accessible scroller.

### Forms and overlays

`ValidatedForm` and `validateFields` own accessible submit validation; retained fragment forms use the same helper. `SearchInput` owns clearing and composition-safe input. Native select/date controls are intentional: the supported browser/OS owns their popup geometry and calendar language. Dialogs/drawers use `Modal`, the browser top layer and body portal. `useDecision` supplies confirmations and text entry through that same primitive. Tooltips are placed inside an active dialog when needed and inherit the active admin scope.

### Motion

**The Confirmed Travel Rule.** Launch a Bucketlist plane only after the existing mutation confirms success; cart travel follows a validated browser-local addition. Flights decorate the actual state and counts, never manufacture them.

`travelFlight` owns both paths. The custom SVG plane uses the existing teal, off-white and gold; product travel uses the actual selected image and a visible photograph as its origin, falling back to the clicked control. Both follow a measured cubic Bézier over (800ms), sampled in (41) keyframes, with linear timing along the samples and shrinking scale. Plane rotation follows the curve tangent. The actual visible Bucketlist/cart control supplies the endpoint; the visible portion of a clipped source supplies its origin.

When a target is absent, hidden, offscreen or outside the active native dialog, use a local flourish (300ms). Reduced motion creates no traveling node and preserves real state, count and static receiving feedback. Decorative nodes are inaccessible, pointer-free and outside layout. There are at most (6) concurrent flights; completion, cancellation, navigation, viewport resize, page hiding and lifecycle unmount clean them up. A receiving pulse preserves the control's original transform; count feedback animates only the real displayed value (200ms). Avoid continuous animation in member/admin work and disable selection transitions under reduced motion.

### Traveler preferences and identity

Selectable interest and preference tiles retain native checkbox/radio semantics within the shared form. Navy panels, teal borders and raised selected surfaces carry state; a check or radio mark makes selection visible beyond color. Keyboard focus uses the existing gold accent. Back and Continue preserve answers; saving disables affected choices while errors retain the draft. The result uses an existing category icon and one short arrival, absent under reduced motion.

**The Consented Identity Rule.** Public traveler badges appear only after explicit sharing consent. A teal traveler-type badge leads up to two muted interest badges; private answers remain in the owner's account. Badge groups wrap naturally and keep readable labels. The account sharing checkbox shows its pending choice while disabled, announces saving, and restores the confirmed choice on failure.

The account identity and invitation use thin section boundaries rather than a new dashboard shell. Admin traveler insights inherit the active Studio theme and show aggregate counts with a native disclosure for the supported mapping. These feature treatments do not add global type or radius tokens.

### Browsing and editor expansion

Profile navigation uses a circular photograph when available and a drawn person icon otherwise, with an accessible Profile name and the existing guest/member disclosure. It has no visible Profile text label. The sign-in, register and recovery forms share a branded navy form surface with the official palm-lock mark, Outfit headings, Open Sans fields and the established teal links. Field and autofill text use --p2-text. Password visibility is an inset eye icon with an accessible action name. Registration includes confirmation and a visible twelve-character minimum; both the form and server validate matching passwords.

The admin merchandise list always exposes a native Collection filter, including when one collection exists. Its selected value belongs to the list URL. Planner discovery reuses the homepage satellite area map and photographic categories at a compact size, followed by destination pins and a keyboard/touch list. The compact category panel stays in document flow and does not lock page scrolling. Adding keeps the selected destination visible and shows its saved state. Membership-filtered inventory remains authoritative.

The owner clarified that this discovery belongs in the right-hand “Your day, on the map” panel. Explore destinations is its default, with Day stops as a second mode for the saved numbered itinerary. The search column keeps text/filter results and its Explore Our Map action focuses the right panel; it does not embed another map. Search and map share one loaded catalog and the same filters. On phones, the same right panel occupies the Map view, resizes on reveal and can return to name search. Day changes update the add destination target without discarding the current area/category.

The homepage merchandise preview follows Featured Destinations, with three visible products on desktop, a partially visible next product on phones, explicit previous/next buttons, touch scrolling and a View all merch link. Cards show actual catalog photographs, names and PHP prices; they open product details. Native overflow remains keyboard accessible and respects reduced motion. Merchandise routes have one shared floating cart; the upper breadcrumb does not duplicate it. Public Brand and Category selects align with search in one row, scrolling on phones. Collections are named sections, with Unlock Paradise Collection first; admin retains its Collection select. Shared tooltips use phase2.css dock tokens: surface #133842, foreground inherited from the public text token, and accent inherited from the public teal token, independent of the admin theme adapter.

Brand → Collection → Products is the durable catalog hierarchy. Admin selects existing categories, colors, sizes, brands and collections; an adjacent inline Add action creates a reusable option without leaving the product form. The product editor groups Product details, Photos, Options & pricing, Advanced and Publish in document flow. Photos belong to the current editor: upload/add, preview, make cover, reorder, replace and remove. There is no cross-product media picker. Upload feedback stays inline, successful partial uploads remain attached, and save is disabled while uploading. Slugs and SKUs are suggested but editable.

Place area/category/facility selection uses a native add-option select with removable selected values. Multiple verified access points are independent of the destination coordinates. Access pins use teal square markers, transport icons and visible text labels; the destination retains its gold pin. Both map types provide text access-point lists and external Maps links or fallback information. Access-point colors derive from --p2-teal and --p2-on-teal; the new --p2-on-teal maps the existing on-primary value (#08252b) into public runtime CSS. Existing Place entitlement boundaries protect every coordinate.

Trip creation uses start/end dates and an inclusive derived duration. An undated new trip starts with one day. Add day remains in the planner and extends a dated trip’s end date; occupied days cannot be removed by shortening dates. Profile/navigation, photos and native choices retain the shared validation, focus and theme contracts.

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

The 23 October shell refinement consolidates Admin Studio branding, theme, account and website access in its left navigation. The main desktop workspace starts with its task heading; mobile uses a compact section/menu bar and the same utilities inside its navigation drawer. Shared headings, filters, pagination and row hover states use the existing Studio tokens. Portfolio and Bucketlist share the saved-Places page layout, selected tabs, search/filter controls and empty-result panel. Portfolio reads visited records and its removal action only clears visited status.

Merchandise editing keeps Card highlight beside the product selections, with visible Details & care and optional Size guide sections. Native size choices and compact measurement rows use Studio tokens; measurements remain in inches. Collection taglines are optional muted body text directly below collection headings, editable through the existing inline catalog-choice owner. At phone widths, the planner uses compact 44px controls, horizontally scrollable day tabs, a smaller trip heading and a single aligned map-mode row. Selected-day and map-mode contrast remain unchanged.

Preserve the existing public palette and fonts. Selected planner days use a filled teal button, dark text and an explicit Selected label. Optional visit times use native paired time fields, the shared validation/form owner and existing modal/disclosure patterns. Checkout places its introduction beside one payment panel with selected period rows and a live total; profile places membership and traveler preferences beside destination previews and settings. Both stack on mobile. Runtime ownership remains phase2.css; behavior and verification boundaries are recorded in UX-CONTRACT.md.

## Place discovery refinement — 22 October 2026

Place editing uses a normal-flow worktable with direct section links, searchable native traveler checkboxes and ordered nearby rows. Section spacing and thin dividers replace nested cards; existing Studio tokens own both themes. Public nearby recommendations use compact photo-and-text rows, visible Google attribution and a Maps action. Text-only rows remain complete without photography. Touched admin, checkout and destination guidance uses direct task language, with redundant promotional eyebrows removed. The existing palette, type families and shared interaction owners remain unchanged.

## Approved member identity and map system — 22 October 2026

This refinement supersedes the earlier profile-header, planner preview placement and free itinerary rules. Runtime CSS remains canonical in phase2.css. Membership Explorer uses --membership-explorer (#78b5f5); Explorer+ uses --membership-plus, an alias of the existing membership-plan --upd-vip-gold (#d4a344). Tier text and the label overlapping the avatar use those same tokens, separate from the teal traveler identity.

The header places the avatar beside the name and interest-specific linework emblem. Each of the 63 interest masks creates a distinct geometric SVG composition; water, coast, mountain, local landmark, food and coffee layers have confined motion. Likes lists the actual selected interests. The public-review consent control belongs in Settings → Privacy and keeps existing consent/version behavior. Reduced motion removes emblem animation; offscreen and hidden documents pause it.

Planner discovery stays entirely inside the right map card: area → photographic categories → destination choices → preview → existing timed-stop dialog. The compact card owns its internal scrolling without locking the document. Explore destinations/My route use filled teal plus an explicit dot and pressed state; desktop hides the redundant finder/map view switches. View all stops is removed; route bounds still fit the saved stops.

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

Authentication additions retain the compact navy AuthForm, Outfit headings and existing field geometry. The explicit Google button follows its neutral white brand treatment with a multicolor G; email fields remain available beneath a quiet divider. A first-visit privacy banner uses the established panel, type and teal outline actions with equal weight for essential-only and analytics consent. It is portaled to the viewport and contributes measured clearance to the existing fixed dock, including safe-area spacing. Footer preferences reuse the canonical Modal. No ambient animation or new visual system is introduced for authentication or privacy.

Shared StudioTable owns loading skeletons, loaded-empty and failed states via StudioDataState; stale request keys cannot paint an old result or clamp a new filter's page. Loading geometry reserves three rows without ambient animation. Readable activity verbs and entity names replace database identifiers in the studio.

Saved-place pages retain their shared header and tabs but omit filters when there are no records. Phone headers use compact spacing and a 44px planner link. Daily itinerary timelines use the existing type, teal time labels and gold overlap warnings; no estimated journey time is invented. The browser print view is a plain, high-contrast, all-days document with saved notes and Palawan-local times, portaled beside the application so other chrome does not print.

Merchandise calls its local selection a cart throughout. Product editor previews reuse the actual collection-card and detail components with purchase actions, navigation and analytics disabled. The readiness checklist is advisory, with inventory uncertainty explicitly stated; publishing and ordering permissions are unchanged. MapFeedback owns bounded loading, failure and retry feedback in both area and destination maps, and the selected destination pin has a persistent gold/teal state. ContentImage provides a reserved, readable fallback when a cover or destination photo cannot load.
