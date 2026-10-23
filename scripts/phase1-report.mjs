import fs from "node:fs/promises";
const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const publicResults=await read("artifacts/comparisons/public/results.json");
const explorer=await read("artifacts/comparisons/explorer/results.json");
const plus=await read("artifacts/comparisons/explorer-plus/results.json");
const responsive=(await read("artifacts/responsive/results.json")).results;
const routes=await read("artifacts/route-audit.json");
const imported=await read("reference/import-report.json");
const integrity=await read("artifacts/source-integrity.json");
const gates=publicResults.filter(r=>r.id.startsWith("place-"));
const minmax=rows=>`${Math.min(...rows.map(r=>r.mismatchPercent)).toFixed(2)}–${Math.max(...rows.map(r=>r.mismatchPercent)).toFixed(2)}%`;
const home=publicResults.filter(r=>r.id.startsWith("home--"));
const loaded=publicResults.filter(r=>r.id.startsWith("home-loaded"));
const broken=[...publicResults,...explorer,...plus].flatMap(r=>r.readiness?.brokenImages||[]);
const errors=[...publicResults,...explorer,...plus].flatMap(r=>r.errors||[]);
const report=`# Phase 1 implementation and validation report

The Next.js application is implemented in this repository. The production WordPress site and the recorder directory were not modified. Supabase, authentication, payments and administration are not connected.

## Delivered

- Next.js 16.4.1 App Router, React 19.3.1, TypeScript, Tailwind CSS 4, ESLint and Playwright.
- Original homepage hero, exact brand SVG and fonts, six category chips, satellite map, four published area markers, category overlays, featured destinations and footer.
- All 26 area/category combinations, four area archives, eight category archives, public navigation/legal pages and destination routes.
- ${imported.publishedDestinations} published destination records with original taxonomy, attachment and metadata relationships. Four trashed destinations excluded. Current tier counts: 215 Explorer and 168 Explorer+.
- Guest and Explorer upgrade gates; server-only development previews for the member destination bodies.
- Optional fact rows, original introductions, zero/single/multiple-photo galleries, original Swiper/GLightbox behavior, geographic location maps and seven approved reviews. Missing fields stay omitted.
- ${imported.downloadedAssets} original assets downloaded successfully; no failed asset downloads. Complete original uploads and private PHP theme/plugin source were not supplied.
- Reusable server content repository, access boundary, presentation components, read-only import/audit scripts and local comparison tooling.

## Checks completed

- TypeScript and ESLint pass without warnings.
- Production build succeeds. See [build output](artifacts/production-build.log).
- Development and production servers both start successfully on loopback.
- Public Playwright suite: 11 passed; desktop-only skip of the mobile drawer scenario is intentional. Tests cover navigation, map/category flow, search/sort/facets/reset, gates, private-response checks, pending forms, mobile focus and Escape.
- Explorer interaction checks: four passed. Explorer+ checks: six passed, including all ten representative destination bodies, duplicate-photo preservation, zero/single/multiple gallery variants and no React hydration/key errors or horizontal overflow.
- ${routes.checked} local URLs checked, including the complete 441-route recorder inventory and checkout: ${routes.failures.length} failures. The account, bucketlist and portfolio URLs lead to the pending sign-in interface.
- Production was explicitly started with the development tier variable set; production still returns public gates. No client/query/cookie tier override is implemented.
- All ${integrity.reportFilesChecked} original report hashes remain unchanged. Recorder captures were read, never written.

## Measured visual comparisons

Pixelmatch uses a 0.1 threshold and excludes antialias-only differences. Size differences are padded and counted. Full-image scores are retained, including defects in historical capture states. These are measured differences, not a claim of universal pixel perfection.

| Reference set | Captures | Full-image pixel difference |
| --- | ---: | ---: |
| Public destination gates, all eight recorded viewports | ${gates.length} | ${minmax(gates)} |
| About | 2 | ${minmax(publicResults.filter(r=>r.id.startsWith("about--")))} |
| Membership | 2 | ${minmax(publicResults.filter(r=>r.id.startsWith("membership--")))} |
| Homepage, loaded historical viewport frames | ${loaded.length} | ${minmax(loaded)} |
| Homepage, supplemental live viewport captures | ${responsive.length} | ${minmax(responsive)} |
| Homepage, historical full-page references | ${home.length} | ${minmax(home)} |
| Explorer, including upgrade gates | ${explorer.length} | ${minmax(explorer)} |
| Explorer+ detail templates | ${plus.length} | ${minmax(plus)} |

Homepage static regions match more closely: desktop featured band ${home.find(r=>r.id.includes("1440"))?.staticRegions?.featured}% and footer ${home.find(r=>r.id.includes("1440"))?.staticRegions?.footer}%; mobile featured band ${home.find(r=>r.id.includes("390"))?.staticRegions?.featured}% and footer ${home.find(r=>r.id.includes("390"))?.staticRegions?.footer}%.

View [public comparisons](artifacts/comparisons/public/index.html), [Explorer comparisons](artifacts/comparisons/explorer/index.html), [Explorer+ comparisons](artifacts/comparisons/explorer-plus/index.html), and [supplemental responsive measurements](artifacts/responsive/results.json). Each set includes local captures, full pixel diffs, blended overlays, JSON provenance and a Markdown report. Supplemental live captures were made read-only and do not replace the historical recordings.

## Remaining visual differences

1. The historical full-page homepage captures contain a partially restored smooth-scroll state, a glass header partway down the hero, and inactive category tiles below the viewport. The initial mobile frame also precedes the background image load. Normal loaded homepage frames and separately labelled live captures provide the appropriate opening-state comparison; the larger historical full-page differences remain reported.
2. Member detail pages still have small icon, label, spacing, introduction-formatting and action-presentation differences. The single-photo Talaudyong desktop capture retains an approximately 602px content width, while the new intrinsic layout resolves to approximately 573px. This is the largest remaining member-template width discrepancy.
3. Native Mapbox rendering, tile arrival and original incomplete tile captures introduce pixel differences. The original provider, imagery style, coordinates, bounds, zoom, pan, marker behavior and camera timings are retained.
4. Pending account, review and contact captions intentionally differ from the functional production forms. They prevent an unconnected feature from falsely appearing to submit or save. Member account buttons remain disabled rather than simulating persistence.
5. Original asset-popover explanatory descriptions are absent from the supplied ACF/export data. Labels and touch/hover tooltips are retained; explanatory prose has not been invented.
6. There are no historical tablet homepage references. All eight homepage viewports were checked against separate live read-only captures. The recorder has only 15 visually inspected routes and ten representative destinations; this is not a screenshot audit of all 383 destination bodies.

Captured application page/React errors: ${errors.length}. Broken visible image elements in the historical comparison runs: ${broken.length}. See per-capture JSON for exact readiness and any external-resource limits.

## Integration work remaining

| Feature | Required integration |
| --- | --- |
| Register, sign in/out, reset passwords | Supabase Auth and server session handling |
| Explorer / Explorer+ authorization | Server membership records, subscription status and RLS |
| Destination data editing and queries | Supabase PostgreSQL schema/import preserving WordPress IDs and terms |
| Protected photos | Supabase Storage, authenticated access policy and complete media migration |
| Bucketlist, visited and featured places | Per-user database relationships and authorized writes |
| Ratings, review submission, likes | Authenticated database operations and moderation |
| Membership checkout/payments | Payment provider and verified subscription webhooks |
| Contact form delivery | Server-side delivery/storage integration |
| Administration | Future Next.js /admin, not started in Phase 1 |
| Hostinger hosting | Target-runtime compatibility, environment and deployment testing |

The application currently uses no Supabase credentials and performs no production WordPress writes. See [README.md](README.md) for run, import, preview and verification commands and [reference/AUDIT.md](reference/AUDIT.md) for the recorder's limitations and access-classification error.
`;
await fs.writeFile("PHASE1-REPORT.md",report);
console.log(`Report saved: ${publicResults.length+explorer.length+plus.length} historical comparisons, ${responsive.length} supplemental viewport comparisons, ${routes.checked} routes.`);
