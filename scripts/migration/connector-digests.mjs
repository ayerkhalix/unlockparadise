import { readFile, writeFile } from "node:fs/promises";
import { database } from "../../tests/integration/database.mjs";
const db = await database();
try {
  await db.exec("set timezone='UTC'");
  const batches = JSON.parse(await readFile("artifacts/backend-private/connector-batches.json", "utf8"));
  for (const batch of batches) await db.exec(batch.query);
  const tables = ["places", "place_details", "areas", "categories", "media", "media_files", "place_areas", "place_categories", "place_media", "taxonomy_media", "place_redirects", "app_settings"];
  const queries = tables.map(table => `select '${table}' as table_name, count(*)::int as row_count, md5(coalesce(string_agg((to_jsonb(t)-'created_at'-'updated_at')::text,E'\\n' order by (to_jsonb(t)-'created_at'-'updated_at')::text),'')) as content_digest from public.${table} t`);
  const selection = queries.join(" union all ");
  const expected = (await db.query(selection)).rows;
  const query = "begin;set local timezone='UTC';" + selection + ";commit;";
  await writeFile("artifacts/backend-private/connector-digests.json", JSON.stringify({ query, expected }, null, 2));
  console.log(JSON.stringify({ tables: expected.length, expected, excludes: ["created_at", "updated_at"], note: "No identities imported; all other columns included, including paths, checksums, dates, flags and coordinates." }));
} finally { await db.close(); }
