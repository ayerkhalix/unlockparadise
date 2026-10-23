// Read-only API safety copy. A pg_dump backup is still required before cutover:
// the Data API does not export private schemas, password hashes, or a DB snapshot.
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const expected = "iitblbdqztuxdzpaetie";
const url = process.env.MIGRATION_SOURCE_SUPABASE_URL;
const key = process.env.MIGRATION_SOURCE_SECRET_KEY;
let validUrl = false;
try {
  validUrl = new URL(url).origin === `https://${expected}.supabase.co`;
} catch {
  /* Do not log URLs: malformed credentials can contain passwords. */
}
if (!validUrl || !key || process.env.MIGRATION_SOURCE_PROJECT_REF !== expected)
  throw new Error("Pinned source API configuration required");
const inventory = JSON.parse(
  (
    await readFile(
      "artifacts/client-migration/source-table-inventory.json",
      "utf8",
    )
  ).replace(/^\uFEFF/, ""),
);
if (inventory.source !== expected) throw new Error("Source inventory mismatch");
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const root = path.resolve("artifacts/client-migration/backups", timestamp);
await mkdir(root, { recursive: true, mode: 0o700 });
const report = {
  source: expected,
  startedAt: new Date().toISOString(),
  kind: "api-safety-copy",
  completeDatabaseBackup: false,
  transactionConsistent: false,
  missing: [
    "private schemas",
    "schema and policies",
    "password hashes",
    "MFA secrets",
    "migration history",
    "Auth service configuration",
  ],
  tables: [],
  objects: [],
  files: [],
  status: "running",
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function save(relative, value) {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(JSON.stringify(value, null, 2) + "\n");
  await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
  report.files.push({
    file: relative,
    bytes: bytes.length,
    sha256: sha256(bytes),
  });
}
function check(error, operation) {
  if (error)
    throw new Error(
      `${operation}_failed_${String(error.code || error.status || "api").replace(/[^a-zA-Z0-9_-]/g, "")}`,
    );
}
try {
  for (const table of inventory.tables.filter(
    (t) => t.schema_name === "public",
  )) {
    if (!/^[a-z_]+$/.test(table.table_name))
      throw new Error("Unsafe table identifier");
    const ordering = table.primary_key.length
      ? table.primary_key
      : ["area_id", "category_id", "media_id"];
    if (ordering.some((c) => !/^[a-z_]+$/.test(c)))
      throw new Error("Unsafe order identifier");
    const rows = [];
    let expectedCount;
    while (true) {
      let query = db.from(table.table_name).select("*", { count: "exact" });
      for (const column of ordering)
        query = query.order(column, { ascending: true, nullsFirst: true });
      const { data, count, error } = await query.range(
        rows.length,
        rows.length + 999,
      );
      check(error, table.table_name);
      if (!Number.isSafeInteger(count))
        throw new Error("Exact row count unavailable");
      expectedCount ??= count;
      if (count !== expectedCount)
        throw new Error(`${table.table_name}_changed_during_backup`);
      if (!data.length) break;
      rows.push(...data);
      if (rows.length >= expectedCount) break;
    }
    if (rows.length !== expectedCount)
      throw new Error(`${table.table_name}_count_mismatch`);
    await save(`public/${table.table_name}.json`, rows);
    report.tables.push({ table: table.table_name, rows: rows.length });
    console.log(JSON.stringify({ table: table.table_name, rows: rows.length }));
  }
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    check(error, "auth_user_export");
    users.push(...data.users);
    if (data.nextPage == null || !data.users.length) break;
  }
  await save("auth/admin-users-without-password-hashes.json", users);
  report.authUsers = users.length;
  const { data: buckets, error: bucketsError } = await db.storage.listBuckets();
  check(bucketsError, "bucket_inventory");
  await save("storage/buckets.json", buckets);
  async function list(bucket, prefix = "", depth = 0) {
    if (depth > 32) throw new Error("Storage folder depth exceeded");
    const files = [];
    for (let offset = 0; ;) {
      const { data, error } = await db.storage.from(bucket).list(prefix, {
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      check(error, "storage_list");
      if (!data.length) break;
      offset += data.length;
      for (const entry of data) {
        const name = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id == null)
          files.push(...(await list(bucket, name, depth + 1)));
        else files.push({ bucket, name, metadata: entry });
      }
    }
    return files;
  }
  for (const bucket of buckets) {
    for (const object of await list(bucket.id)) {
      const { data, error } = await db.storage
        .from(bucket.id)
        .download(object.name);
      check(error, "storage_download");
      const bytes = Buffer.from(await data.arrayBuffer());
      const file = `storage/objects/${sha256(`${bucket.id}/${object.name}`)}.bin`;
      await save(file, bytes);
      const saved = await readFile(path.join(root, file));
      if (sha256(saved) !== sha256(bytes))
        throw new Error("Local object verification failed");
      report.objects.push({
        ...object,
        file,
        bytes: bytes.length,
        sha256: sha256(bytes),
      });
    }
  }
  report.status = "api-copy-complete";
} catch (error) {
  report.status = "failed";
  report.error = /^[a-zA-Z0-9_ -]+$/.test(error.message)
    ? error.message
    : "backup_failed";
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(
    path.join(root, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      status: report.status,
      tables: report.tables.length,
      users: report.authUsers,
      objects: report.objects.length,
      directory: root,
      error: report.error,
    }),
  );
}
