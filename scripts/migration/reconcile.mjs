import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY;
if (
  !url ||
  !key ||
  process.env.UPD_ENVIRONMENT !== "staging" ||
  new URL(url).hostname.split(".")[0] !== process.env.MIGRATION_PROJECT_REF
)
  throw new Error("Pinned staging configuration required.");
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const expected = JSON.parse(
  await readFile("artifacts/backend-private/content-manifest.json", "utf8"),
);
const report = {
  mode: process.argv.includes("--metadata-only") ? "metadata-only" : "complete-storage",
  counts: {},
  mismatches: [],
  excluded_test_absent: false,
  media_ready: 0,
  media_files_ready: 0,
};
for (const table of [
  "places",
  "place_details",
  "areas",
  "categories",
  "place_areas",
  "place_categories",
  "media",
  "media_files",
  "place_media",
  "taxonomy_media",
  "place_redirects",
]) {
  let records = [],
    total = 0;
  for (let offset = 0; ; offset += 1000) {
    const order =
      table === "place_details"
        ? "place_id"
        : table === "place_areas"
          ? "place_id"
          : table === "place_categories"
            ? "place_id"
            : table === "place_media"
              ? "place_id"
              : table === "taxonomy_media" ? "media_id" : table === "place_redirects" ? "slug" : "id";
    let query = db
      .from(table)
      .select("*", { count: "exact" })
      .order(order);
    if (table === "place_media") query = query.order("kind").order("position");
    if (table === "place_areas") query = query.order("area_id");
    if (table === "place_categories") query = query.order("category_id");
    const result = await query.range(offset, offset + 999);
    if (result.error) throw new Error("Reconciliation query failed: " + table);
    records.push(...result.data);
    total = result.count;
    if (records.length >= total || !result.data.length) break;
  }
  report.counts[table] = { expected: expected[table].length, actual: total };
  for (const source of expected[table]) {
    const current = records.find((row) =>
      table === "place_details"
        ? row.place_id === source.place_id
        : table === "place_areas"
          ? row.place_id === source.place_id && row.area_id === source.area_id
          : table === "place_categories"
            ? row.place_id === source.place_id &&
              row.category_id === source.category_id
            : table === "place_media"
              ? row.place_id === source.place_id &&
                row.kind === source.kind &&
                row.position === source.position
              : table === "taxonomy_media" ? row.media_id === source.media_id && row.area_id === source.area_id && row.category_id === source.category_id
              : table === "place_redirects" ? row.slug === source.slug : row.id === source.id,
    );
    if (!current) {
      report.mismatches.push({
        table,
        legacy_id: source.legacy_id || null,
        reason: "missing_row",
      });
      continue;
    }
    for (const [field, value] of Object.entries(source)) {
      if (
        ["created_at", "updated_at", "published_at"].includes(field) ||
        (field === "status" && ["media", "media_files"].includes(table))
      )
        continue;
      const normalize = (x) =>
        x && typeof x === "object" && !Array.isArray(x)
          ? Object.fromEntries(
              Object.keys(x)
                .sort()
                .map((k) => [k, normalize(x[k])]),
            )
          : Array.isArray(x)
            ? x.map(normalize)
            : x;
      if (
        JSON.stringify(normalize(current[field])) !==
        JSON.stringify(normalize(value))
      )
        report.mismatches.push({
          table,
          legacy_id: source.legacy_id || null,
          field,
          reason: "value_mismatch",
        });
    }
  }
  if (table === "places")
    report.excluded_test_absent = !records.some((p) => p.legacy_id === 5693);
  if (table === "media")
    report.media_ready = records.filter((m) => m.status === "ready").length;
  if (table === "media_files")
    report.media_files_ready = records.filter(
      (m) => m.status === "ready",
    ).length;
}
report.metadata_reconciled =
  report.excluded_test_absent &&
  report.mismatches.length === 0 &&
  Object.values(report.counts).every((c) => c.actual === c.expected);
report.storage_complete =
  report.media_ready === expected.media.length &&
  report.media_files_ready === expected.media_files.length;
report.passed = report.metadata_reconciled && (report.mode === "metadata-only" || report.storage_complete);
await writeFile(
  "artifacts/staging-reconciliation.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    passed: report.passed,
    mismatches: report.mismatches.length,
    media_ready: report.media_ready,
  }),
);
if (!report.passed) process.exitCode = 1;
