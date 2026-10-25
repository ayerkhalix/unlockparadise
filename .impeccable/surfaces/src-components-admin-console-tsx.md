---
version: 1
slug: "src-components-admin-console-tsx"
primary_target: "src/components/admin-console.tsx"
related_targets: ["src/app/admin/studio-design.css","src/app/admin/admin.css","src/app/client-todo.css","src/components/admin/overview.tsx","src/components/admin/studio-icon.tsx","src/components/place-editor.tsx","src/components/rich-text-editor.tsx","src/components/travel-guide.tsx"]
---

# Admin Studio: the collection desk

## Scope and mode
Redesign /admin and its existing eight modules. Operate mode. Keep public pages, current navy/teal/gold and warm light colors, actual data, permissions, forms and business rules intact. User explicitly delegated finding inspiration and choosing the direction; requested a more impressive result with modern motion.

## Audience and job
The owner and authorized content/order staff maintain Palawan Places, photographs, merchandise, members and reviews. Frequent tasks must remain direct and recognizable. Proof is the actual Place library and existing data, never invented growth charts or metrics.

## WORLD
A museum collection desk translated to a Palawan publishing studio: an indexed navigation rail, generous photographic contact sheet, disciplined catalog rows and a distinct review column. Inspired by the V&A's collection-first hierarchy, not its branding. Existing Outfit headings, Open Sans task text, real photography and brand palette remain authoritative. Dark and warm-light modes both ship. Avoid the KPI-card wall and its predictable monochrome newspaper opposite.

## FIRST VIEWPORT
At 1440px: a compact 228px navy rail; a sticky contextual breadcrumb/date strip of at least 56px; a roomy title/action line. Branding/account/website utilities stay in the rail. The client PDF moves the compact sun/moon theme control to the upper right of the content header, retaining its accessible label, tooltip and persistence. The overview opens with a wide photographic Place selection, an administrator Merchandise library below it, and a narrower task ledger beside both. Actual product photographs, names and collection names open the existing editor, with an Open library action. Published/draft/member counts remain inline facts. Source/focus order is Place library → Merchandise library when permitted → operations/Create → journal. The merchandise layout stacks at 900px and below. At 390px the strip is at least 60px, its white official mark has a navy support surface in either theme, the date is hidden, and Menu opens the shared drawer. Other modules retain shared title, tabs, filters, tables and natural editor flow.

## SIGNATURE INTERACTION
The selected navigation entry has a small gold marker and a quiet teal field, current-page semantics and a heavier readable label. Photographic Place entries are real editor actions: their image expands to 1.045 over 500ms and the circular arrow moves 2px over 250ms on hover/focus. Module/editor changes arrive once over 240ms with opacity 0.7 → 1 and a 6px heading settle; filtering does not replay arrival. Section/ledger arrows travel 3px over 150–160ms. Reduced motion removes arrival and makes transitions immediate. Mobile menu retains the existing native Modal's focus trap and restoration. Forms retain dirty-state, validation, preview and saving semantics.

## SYSTEM GRAMMAR
Content owns the surface; controls do not become decoration. Outfit titles use a 30–40px ramp at weight 500; sections are 22px, with library/journal headings 20px on narrow phones. Open Sans controls and record text are 13px, metadata 11–12px, phone fields 16px; journal dates remain 11px and reflow below actions on phones. Photo titles are 17px (16px on narrow phones). Buttons/nav have 8px corners, fields 7px, data/filter planes 14px and overview photos 12px. Structural group rules do not create nested cards. Color remains owned by admin.css, with existing navy rail hover/muted values and translucent teal selection recorded in DESIGN.md. studio-design.css owns this surface's geometry and motion. The shared StudioTable, Filters, LoadState, Modal, confirmation and theme components remain canonical. Collection links, owner counts and review queues are role-filtered just like their existing routes.

The rail narrows to 204px at 1200px and below, grows to 248px at 1750px and above, and becomes the drawer at 800px and below. Content is capped at 1630px; long editors at 1120px. Tables use layout/paint containment, sticky desktop headers and a bounded min(68svh, 760px) scroller; phone labeled records keep a 70svh bound. Place/product editors grow with the document, with sticky actions rather than a bounded editor viewport.

## CONTENT AND STATES
Real data from existing authorized endpoints only. Image failures keep title/edit access. Fetch failures show retries and never become zeros or false empty states. No sales or membership claims inferred from browsing. Existing persisted URL filters, page limits, native selects, form inputs and safe CRUD remain. Do not delete staging records as a design change.

## Seed and reference decision
Seed 87100de2, assigned candidate 6 of seven grounded systems: field guide, library catalog, publishing desk, contact sheet, route operations board, museum collection desk, harbor dispatch board. User delegated the choice; build the assigned collection desk directly in the functional application. Code-led implementation, with actual app captures as the review reference rather than a generated comp. No raster assets need generation.

Challenger judgments: exposure sheets declined (keep clear grouping without layered forms); transit diagram competitive on wayfinding (keep location context while rejecting ornamental route lines); monochrome marketing declined (keep restraint and one primary action); Factory catalog declined (retain precise image/data alignment, always readable labels); cassette inlay declined (keep compact task boundaries, no physical flip); character roster declined (keep useful whole-image selection, no mascots or toy motion). Palette is pinned by the user and governs all translations.

## Constraints and open decisions
No unresolved business decisions. Preserve brand colors, all existing capabilities and access boundaries. Never activate checkout, change email settings, create sales, grant roles or publish records during visual work. Verify the shared shell, both themes, overview, lists, long forms, menu, loading/error/empty states, keyboard, reduced motion and a narrow viewport in bounded rounds. The collection-desk metaphor belongs to this operating surface and does not replace the public site's map/travel-notebook identity.

## Accepted implementation evidence — 24 October 2026

The later client PDF retains this world and adds the Merchandise library, content-header theme control, visual description editor and plain road/boat journey fields. The description owner preserves supported markup, optional advanced source, server sanitization and dirty/version protection. Both libraries retain loading, failure/retry, empty and image fallback states; merchandise reads the actual collection relation. Local screenshots are in artifacts/client-todo, with the initial finish review and post-review fix status recorded in CLIENT_TODO_DELIVERY.md. Staging release, live map tiles and print pagination are not certified by this surface brief.
The finish review's three runtime corrections are present: official phone mark on navy support, semantic library → operations/Create → journal order with the desktop grid preserved, and 11px journal dates with phone reflow. All 14 supplied final captures were visually inspected: overview in both themes at 1440px/390px; Places, merchandise, settings and both editors at those widths. Editor captures are viewport samples; other captures are full-page. The parent reports eight redesign browser checks, two existing admin regression checks, typecheck, lint, production build and release secret/browser-bundle scan passing after the final fixes. Documentation inspection verifies source/capture consistency; it does not claim independent execution of those checks or coverage of every record, native popup or assistive technology.
## Photo focal-point editing — 25 October 2026

Keep the current studio shell and editors. Place cover/gallery and product photos share an inline Adjust photo crop disclosure, uncropped pointer/touch/keyboard focus selection, card preview and center reset. Existing dirty-draft guards, busy locking, role/MFA/version checks and transactional saves remain authoritative. Save crop metadata without rewriting originals; retain it when an older client saves the image association. Verify persistence, reset, failed-save draft retention and narrow phone geometry. Evidence is tracked in UX_POLISH_DELIVERY.md.
