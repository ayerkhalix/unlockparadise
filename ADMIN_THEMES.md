# Admin themes

Admin defaults to dark navy. The single `AdminThemeScope` reads a server-provided initial preference and applies it only to `/admin` routes, excluding public-style Place previews. Public pages keep their existing tokens.

`RootLayout` reads the whitelisted `upd-admin-theme` cookie using the installed async Next.js cookies API. A toggle writes `dark` or `light`, SameSite=Lax, one-year lifetime and Secure on HTTPS. The initial server attribute and hydrated state agree; there is no post-mount localStorage theme swap. The preference persists through admin navigation and reload.

Runtime source of truth is `src/app/admin/admin.css`: `--studio-*` owns navy background, panels, ink, muted copy, borders, action/inverse, focus, danger and status pairs. A single adapter maps those tokens into shared `--p2-*` components. Native inputs use the active `color-scheme`. The browser/OS owns native dropdown and date-picker popup geometry.

Dark: background #081823, surface #102732, text #f4f4eb, muted #b4c6cb, teal #83d9c6, gold focus #dfc18a. Light: sand #f7f4ed, surface #fffdf8, ink #183d42, muted #52696b, teal #14665f, focus #906119. Both retain the navy rail.

The existing official palm-lock image appears in the sidebar, mobile header/drawer and MFA entry. Portal dialogs read the same context and carry the theme attribute. Delegated tooltips copy the nearest theme; notices inherit the active scope. No separate overlay theme provider exists.

Tables preserve their semantics, stack labeled rows on phones, and own wide-content overflow. Editors remain in normal document flow. Primary actions, summaries and editor controls favor 44px targets. Overview puts Studio shortcuts ahead of attention items in both DOM and visual order, keeping Add Place and Add product reachable on phones. It uses real counts and five recent events; no fabricated sales or charts are introduced. MFA’s content frame is capped at 560px with 24px internal gutters.
