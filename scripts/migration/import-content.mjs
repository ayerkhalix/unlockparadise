import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import postgres from "postgres";
const apply = process.argv.includes("--apply");
const expected = process.env.MIGRATION_PROJECT_REF;
const url = process.env.SUPABASE_DB_URL;
const source =
  process.argv.find((x) => x.startsWith("--input="))?.slice(8) ||
  "artifacts/backend-private/content-import.sql";
const sql = await readFile(source, "utf8");
if (!sql.startsWith("begin;") || !sql.trimEnd().endsWith("commit;"))
  throw new Error("Transactional migration file required.");
console.log(
  JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    sha256: createHash("sha256").update(sql).digest("hex"),
  }),
);
if (!apply) process.exit(0);
if (process.env.UPD_ENVIRONMENT !== "staging" || !expected || !url)
  throw new Error("Explicit isolated staging configuration is required.");
const dbUrl = new URL(url);
if (!dbUrl.hostname.includes(expected) && !dbUrl.username.includes(expected))
  throw new Error(
    "Database target does not match the pinned project reference.",
  );
const db = postgres(url, {
  max: 1,
  ssl: "require",
  debug: false,
  onnotice: () => {},
});
try {
  await db.unsafe(sql);
  console.log(
    "Content transaction applied. Run reconciliation before marking migration complete.",
  );
} catch (error) {
  console.error(
    JSON.stringify({
      event: "content_import_failed",
      code: error.code || "unknown",
    }),
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
