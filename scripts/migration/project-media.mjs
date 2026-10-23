// Copies current database media, including new uploads, without overwriting any
// differing object. A verified download is required before marking a row ready.
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, rename, realpath } from "node:fs/promises";
import path from "node:path";
import { configuration, connect } from "./project-database.mjs";
import { validMime } from "./file-validation.mjs";

const { TARGET, env } = await configuration();
if (
  env.MIGRATION_TARGET_SUPABASE_URL !== `https://${TARGET.ref}.supabase.co` ||
  !env.MIGRATION_TARGET_SECRET_KEY
)
  throw new Error("Pinned target Storage configuration required");
const api = createClient(
  env.MIGRATION_TARGET_SUPABASE_URL,
  env.MIGRATION_TARGET_SECRET_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
const db = connect(TARGET);
const root = path.resolve("artifacts/client-migration/media");
await mkdir(root, { recursive: true, mode: 0o700 });
const legacyRoot = await realpath("reference/wp-content/uploads");
const backupRoot = path.resolve(
  "artifacts/client-migration/backups/2026-10-23T06-44-20-172Z",
);
const uploadedBackup = JSON.parse(
  await readFile(path.join(backupRoot, "report.json"), "utf8"),
);
if (
  uploadedBackup.source !== "iitblbdqztuxdzpaetie" ||
  uploadedBackup.status !== "api-copy-complete"
)
  throw new Error("Verified current Storage backup required");
const uploaded = new Map(
  uploadedBackup.objects.map((o) => [`${o.bucket}/${o.name}`, o]),
);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const numberOption = (key, fallback) =>
  Number(
    process.argv
      .find((a) => a.startsWith(`--${key}=`))
      ?.slice(key.length + 3) ?? fallback,
  );
const concurrency = numberOption("concurrency", 6),
  limit = numberOption("limit", Number.MAX_SAFE_INTEGER);
if (
  !Number.isSafeInteger(concurrency) ||
  concurrency < 1 ||
  concurrency > 24 ||
  !Number.isSafeInteger(limit) ||
  limit < 1
)
  throw new Error("Invalid concurrency or limit");
const apply = process.argv.includes("--apply");
const reportFile = path.join(root, "progress.json");
let report = {
  target: TARGET.ref,
  objects: {},
  failed: [],
  startedAt: new Date().toISOString(),
};
try {
  report = JSON.parse(await readFile(reportFile, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (report.target !== TARGET.ref) throw new Error("Progress project mismatch");
report.failed = [];
async function checkpoint() {
  report.updatedAt = new Date().toISOString();
  await writeFile(`${reportFile}.tmp`, JSON.stringify(report, null, 2), {
    mode: 0o600,
  });
  await rename(`${reportFile}.tmp`, reportFile);
}
async function retry(action) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await action();
    } catch (error) {
      if (attempt >= 3 || error.permanent) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
}
try {
  const security =
    await db`select count(*)::int n from supabase_migrations.schema_migrations where name='client_storage_security'`;
  if (security[0].n !== 1)
    throw new Error("Apply client Storage security before copying media");
  const media = await db`select * from public.media order by id`;
  const files = await db`select * from public.media_files order by id`;
  const parents = new Map(media.map((m) => [m.id, m]));
  const protectedMedia = new Set(
    (
      await db`select distinct pm.media_id from public.place_media pm join public.places p on p.id=pm.place_id where p.vip_content`
    ).map((m) => m.media_id),
  );
  const all = [
    ...media.map((m) => ({ ...m, table: "media" })),
    ...files.map((m) => ({ ...m, table: "media_files" })),
  ];
  const planned = [],
    keys = new Map();
  for (const object of all) {
    const parent =
      object.table === "media" ? object : parents.get(object.media_id);
    if (!parent || !object.checksum || !/^[a-f0-9]{64}$/.test(object.checksum))
      throw new Error("Missing media checksum or relationship");
    if (object.status === "missing")
      throw new Error("Missing source media must be resolved");
    const key = `${object.bucket}/${object.object_path}`;
    if (keys.has(key) && keys.get(key) !== object.checksum)
      throw new Error("Conflicting object contents");
    keys.set(key, object.checksum);
    // A protected image may have moved buckets during the privacy migration.
    // Its original source object and verified checksum are still authoritative.
    const stored =
      uploaded.get(key) ||
      uploadedBackup.objects.find(
        (entry) =>
          entry.name === object.object_path && entry.sha256 === object.checksum,
      );
    let local;
    if (object.original_path) {
      local = path.resolve(legacyRoot, object.original_path);
      if (!local.startsWith(legacyRoot + path.sep))
        throw new Error("Unsafe legacy path");
    } else if (stored) {
      local = path.resolve(backupRoot, stored.file);
      if (
        !local.startsWith(backupRoot + path.sep) ||
        stored.sha256 !== object.checksum
      )
        throw new Error("Uploaded backup mismatch");
    } else
      throw new Error("Source object unavailable in local or Storage backup");
    planned.push({ ...object, key, local });
  }
  // Verify source bytes for every object, even when a previous run uploaded it.
  let sourceBytes = 0;
  for (let offset = 0; offset < planned.length; offset += concurrency) {
    await Promise.all(
      planned.slice(offset, offset + concurrency).map(async (item) => {
        const actualPath = await realpath(item.local);
        const allowedRoot = item.original_path ? legacyRoot : backupRoot;
        if (!actualPath.startsWith(allowedRoot + path.sep))
          throw new Error("Source symlink escaped its root");
        const bytes = await readFile(actualPath);
        if (
          bytes.length !== Number(item.byte_size) ||
          sha256(bytes) !== item.checksum ||
          !validMime(bytes, item.mime_type)
        )
          throw new Error("Source file checksum size or format changed");
        sourceBytes += bytes.length;
      }),
    );
  }
  report.planned = planned.length;
  report.sourceBytes = sourceBytes;
  await writeFile(
    path.join(root, "plan.json"),
    JSON.stringify(
      {
        target: TARGET.ref,
        bytes: sourceBytes,
        objects: planned.map(({ local, ...item }) => ({
          ...item,
          sourceFile: path.relative(process.cwd(), local),
        })),
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      event: "sources_verified",
      objects: planned.length,
      bytes: sourceBytes,
      alreadyVerified: Object.keys(report.objects).length,
      mode: apply ? "apply" : "dry-run",
    }),
  );
  if (!apply) process.exit(0);
  const sample = process.argv.includes("--sample")
    ? new Set(
        [
          planned.find(
            (m) =>
              m.table === "media" &&
              m.bucket === "destination-public" &&
              m.original_path,
          ),
          planned.find(
            (m) =>
              m.table === "media" &&
              m.bucket === "destination-private" &&
              m.original_path &&
              protectedMedia.has(m.id),
          ),
          planned.find(
            (m) =>
              m.table === "media_files" &&
              m.bucket === "destination-private" &&
              protectedMedia.has(m.media_id),
          ),
          planned.find((m) => m.bucket === "media-archive"),
          planned.find((m) => !m.original_path),
        ]
          .filter(Boolean)
          .map((m) => `${m.table}/${m.id}`),
      )
    : null;
  const pending = planned
    .filter(
      (m) =>
        (!sample || sample.has(`${m.table}/${m.id}`)) &&
        (report.objects[`${m.table}/${m.id}`]?.sha256 !== m.checksum ||
          report.objects[`${m.table}/${m.id}`]?.key !== m.key),
    )
    .slice(0, limit);
  let cursor = 0,
    stopping = false,
    flushTail = Promise.resolve();
  const successful = [];
  process.once("SIGINT", () => {
    stopping = true;
  });
  process.once("SIGTERM", () => {
    stopping = true;
  });
  function flush(force = false) {
    if (!successful.length || (!force && successful.length < 128))
      return Promise.resolve();
    const batch = successful.splice(0, force ? successful.length : 128);
    flushTail = flushTail.then(async () => {
      for (const table of ["media", "media_files"]) {
        const ids = batch
          .filter((item) => item.table === table)
          .map((item) => item.id);
        if (ids.length) {
          const changed =
            await db`update ${db(`public.${table}`)} set status='ready' where id in ${db(ids)} returning id`;
          if (changed.length !== ids.length)
            throw new Error("Media readiness count mismatch");
        }
      }
      for (const item of batch)
        report.objects[`${item.table}/${item.id}`] = {
          key: item.key,
          sha256: item.checksum,
          bytes: Number(item.byte_size),
          verifiedAt: new Date().toISOString(),
        };
      await checkpoint();
      console.log(
        JSON.stringify({
          verified: Object.keys(report.objects).length,
          planned: planned.length,
          failed: report.failed.length,
          verifiedBytes: Object.values(report.objects).reduce(
            (n, x) => n + x.bytes,
            0,
          ),
        }),
      );
    });
    return flushTail;
  }
  async function worker() {
    while (cursor < pending.length && !stopping && !report.failed.length) {
      const item = pending[cursor++];
      try {
        const bytes = await readFile(item.local);
        if (sha256(bytes) !== item.checksum)
          throw new Error("Source changed during copy");
        const store = api.storage.from(item.bucket);
        await retry(async () => {
          const { error } = await store.upload(item.object_path, bytes, {
            contentType: item.mime_type,
            upsert: false,
          });
          if (
            error &&
            !["409", "Duplicate"].includes(String(error.statusCode)) &&
            !/already exists|duplicate/i.test(error.message)
          )
            throw new Error("Storage upload failed");
        });
        const actual = await retry(async () => {
          const { data, error } = await store.download(item.object_path);
          if (error) throw new Error("Storage verification download failed");
          return Buffer.from(await data.arrayBuffer());
        });
        if (
          actual.length !== bytes.length ||
          sha256(actual) !== item.checksum
        ) {
          const error = new Error("Remote object differs; never overwritten");
          error.permanent = true;
          throw error;
        }
        successful.push(item);
        await flush();
      } catch (error) {
        report.failed.push({
          table: item.table,
          id: item.id,
          reason: error.message,
        });
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  await flush(true);
  await flushTail;
  if (report.failed.length) {
    await checkpoint();
    throw new Error("Media copy stopped; see private progress report");
  }
  report.status =
    Object.keys(report.objects).length === planned.length
      ? "all-media-verified"
      : "batch-verified";
  await checkpoint();
} finally {
  await db.end({ timeout: 3 });
}
