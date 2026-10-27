import { readFile, writeFile, mkdir } from "node:fs/promises";
import { mediaContext } from "./context.mjs";
const { db } = await mediaContext();
const root = "artifacts/performance-optimization";
await mkdir(root, { recursive: true });
const tables = [
  "places",
  "place_media",
  "taxonomy_media",
  "merch_products",
  "itineraries",
  "itinerary_days",
  "itinerary_items",
  "media",
  "media_files",
];
try {
  await db`begin read only`;
  const data = {};
  for (const table of tables)
    data[table] = await db`select * from ${db("public." + table)}`;
  await db`rollback`;
  if (process.argv.includes("--before")) {
    await writeFile(`${root}/data-before.json`, JSON.stringify(data));
    console.log("Saved private content snapshot");
  } else {
    const before = JSON.parse(
      await readFile(`${root}/data-before.json`, "utf8"),
    );
    const same = (a, b) =>
      Object.keys(a).every(
        (k) => JSON.stringify(a[k]) === JSON.stringify(b?.[k]),
      );
    const report = {};
    for (const table of tables) {
      const after = data[table];
      const key = (row) =>
        table === "place_media"
          ? `${row.place_id}:${row.kind}:${row.position}`
          : table === "taxonomy_media"
            ? JSON.stringify(row)
            : row.id;
      const lookup = new Map(after.map((r) => [key(r), r]));
      report[table] = {
        before: before[table].length,
        after: after.length,
        originalRowsUnchanged: before[table].every((r) =>
          same(r, lookup.get(key(r))),
        ),
      };
    }
    await writeFile(`${root}/data-audit.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  }
} finally {
  await db.end();
}
