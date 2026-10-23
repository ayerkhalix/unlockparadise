// Restore only into the explicitly pinned, empty client project. Never cleans or
// overwrites an existing database. Keep platform-owned schemas and keys intact.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { configuration, connect, pgTool } from "./project-database.mjs";

const input = process.argv.find((a) => a.startsWith("--backup="))?.slice(9);
if (!input) throw new Error("Explicit --backup directory required");
const backup = path.resolve(input);
if (
  !backup.startsWith(
    path.resolve("artifacts/client-migration/database") + path.sep,
  )
)
  throw new Error("Unsafe backup directory");
const manifest = JSON.parse(
  await readFile(path.join(backup, "report.json"), "utf8"),
);
if (manifest.status !== "backups_complete")
  throw new Error("Completed backups required");
for (const file of manifest.files) {
  const bytes = await readFile(path.join(backup, file.file));
  if (
    bytes.length !== file.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== file.sha256
  )
    throw new Error("Backup verification failed");
}
const { SOURCE, TARGET } = await configuration();
const root = path.join(backup, "restore");
await mkdir(root, { recursive: true, mode: 0o700 });
const toc = await readFile(
  path.join(backup, "source-full.backup.contents.log"),
  "utf8",
);
const lines = toc.split(/\r?\n/);
const schemas = lines.filter(
  (l) =>
    / SCHEMA - (private|supabase_migrations) postgres$/.test(l) ||
    / ACL - SCHEMA (private|public) /.test(l),
);
const customObjects = lines.filter(
  (l) =>
    / TRIGGER auth users create_profile /.test(l) ||
    / POLICY storage objects (archive_storage_delete|archive_storage_read|destination_storage_read|staff_storage_write) /.test(
      l,
    ),
);
if (schemas.length !== 4 || customObjects.length !== 5)
  throw new Error("Unexpected owned object inventory");
for (const [name, selection] of [
  ["schemas", schemas],
  ["custom-objects", customObjects],
]) {
  const list = path.join(root, `${name}.list`);
  await writeFile(list, selection.join("\n") + "\n", { mode: 0o600 });
  await pgTool(
    "pg_restore",
    [
      "--no-owner",
      `--use-list=${list}`,
      `--file=${path.join(root, `${name}.sql`)}`,
      path.join(backup, "source-full.backup"),
    ],
    SOURCE,
  );
}
let appSchema = await readFile(
  path.join(backup, "source-app-schema.sql"),
  "utf8",
);
// Platform defaults already exist on the destination; postgres must not alter
// defaults owned by Supabase's managed administrator role.
const managedDefaults =
  appSchema.match(
    /^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin .*;\r?$/gm,
  ) || [];
appSchema = appSchema.replace(
  /^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin .*;\r?$/gm,
  "",
);
await writeFile(path.join(root, "app-schema.sql"), appSchema, { mode: 0o600 });
let authData = await readFile(
  path.join(backup, "source-auth-data.sql"),
  "utf8",
);
const managedHistory =
  /COPY auth\.schema_migrations \([^\n]*\) FROM stdin;\r?\n[\s\S]*?^\\\.\r?\n/m;
if (!managedHistory.test(authData))
  throw new Error("Auth managed migration history block missing");
authData = authData.replace(
  managedHistory,
  "-- Preserve destination Auth service migration history.\n",
);
await writeFile(path.join(root, "auth-data.sql"), authData, { mode: 0o600 });
await writeFile(
  path.join(root, "prerequisites.sql"),
  "create extension if not exists pg_cron with schema pg_catalog;\n",
  { mode: 0o600 },
);
console.log(
  JSON.stringify({
    mode: process.argv.includes("--apply") ? "apply" : "prepared",
    source: SOURCE.ref,
    target: TARGET.ref,
    managedDefaultsPreserved: managedDefaults.length,
    verifiedBackupFiles: manifest.files.length,
  }),
);
if (!process.argv.includes("--apply")) process.exit(0);
const target = connect(TARGET);
try {
  const [state] = await target`select
    (select count(*)::int from information_schema.tables where table_schema in ('public','private') and table_type='BASE TABLE') app_tables,
    (select count(*)::int from auth.users) users,
    (select count(*)::int from storage.objects) objects,
    to_regclass('supabase_migrations.schema_migrations') history`;
  if (state.app_tables || state.users || state.objects || state.history)
    throw new Error("Destination is not empty; restore refused");
  const args = [
    "--no-psqlrc",
    "--no-password",
    "--single-transaction",
    "--variable=ON_ERROR_STOP=1",
    `--file=${path.join(root, "prerequisites.sql")}`,
    `--file=${path.join(root, "schemas.sql")}`,
    `--file=${path.join(root, "app-schema.sql")}`,
    "--command=SET session_replication_role = replica",
    `--file=${path.join(root, "auth-data.sql")}`,
    `--file=${path.join(backup, "source-app-data.sql")}`,
    `--file=${path.join(backup, "source-history.sql")}`,
    "--command=SET session_replication_role = origin",
    `--file=${path.join(root, "custom-objects.sql")}`,
    "--command=NOTIFY pgrst, 'reload schema'",
  ];
  await pgTool(
    "psql",
    args,
    TARGET,
    path.join(root, `apply-${Date.now()}.private.log`),
  );
  const [result] =
    await target`select (select count(*)::int from auth.users) users,(select count(*)::int from auth.mfa_factors) factors,(select count(*)::int from public.places) places,(select count(*)::int from public.media) media,(select count(*)::int from public.media_files) media_files,(select count(*)::int from supabase_migrations.schema_migrations) migrations`;
  await writeFile(
    path.join(root, "result.json"),
    JSON.stringify(
      {
        status: "database-restored",
        source: SOURCE.ref,
        target: TARGET.ref,
        at: new Date().toISOString(),
        counts: result,
      },
      null,
      2,
    ),
    { flag: "wx", mode: 0o600 },
  );
  console.log(JSON.stringify({ status: "database-restored", ...result }));
} finally {
  await target.end({ timeout: 3 });
}
