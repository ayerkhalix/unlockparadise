import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { validMime } from "./file-validation.mjs";
const apply = process.argv.includes("--apply");
const manifest = JSON.parse(
  await readFile(
    process.env.MIGRATION_MANIFEST ||
      "artifacts/backend-private/content-manifest.json",
    "utf8",
  ),
);
const uploads = path.resolve(
  process.env.WORDPRESS_UPLOADS || "reference/wp-content/uploads",
);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY;
if (
  apply &&
  (process.env.UPD_ENVIRONMENT !== "staging" ||
    !url ||
    !key ||
    !process.env.MIGRATION_PROJECT_REF ||
    new URL(url).hostname.split(".")[0] !== process.env.MIGRATION_PROJECT_REF)
)
  throw new Error("Explicit pinned staging configuration required.");
const db = apply
  ? createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
const allObjects = [
  ...manifest.media.map((m) => ({ ...m, table: "media" })),
  ...(manifest.media_files || []).map((m) => ({
    ...m,
    table: "media_files",
    legacy_id: manifest.media.find((p) => p.id === m.media_id)?.legacy_id,
  })),
];
const option = (name, fallback) => Number(process.argv.find(x => x.startsWith(`--${name}=`))?.split("=")[1] ?? fallback);
const offsetStart = option("offset", 0), limit = option("limit", allObjects.length), concurrency = option("concurrency", 4);
if (![offsetStart, limit, concurrency].every(Number.isSafeInteger) || offsetStart < 0 || limit < 1 || concurrency < 1 || concurrency > 8)
  throw new Error("Use nonnegative offset, positive limit and concurrency between 1 and 8.");
const objects = allObjects.slice(offsetStart, offsetStart + limit);
if (apply && objects.length > 5 && !process.argv.includes("--allow-bulk-media"))
  throw new Error("Bulk upload requires explicit --allow-bulk-media authorization; use --limit=1 for a small development test.");
const report = {
  mode: apply ? "apply" : "dry-run",
  planned: objects.length,
  verified: 0,
  skipped: 0,
  failed: [],
  objects: [],
  offset: offsetStart,
  concurrency,
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function retry(action) {
  let last;
  for (let n = 0; n < 3; n++) {
    try {
      return await action();
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** n));
    }
  }
  throw last;
}
for (let offset = 0; offset < objects.length; offset += concurrency) {
  await Promise.all(
    objects.slice(offset, offset + concurrency).map(async (media) => {
      try {
        if (media.status === "missing") {
          report.skipped++;
          return;
        }
        const source = path.resolve(uploads, media.original_path);
        if (!source.startsWith(uploads + path.sep))
          throw new Error("unsafe_path");
        const bytes = await readFile(source);
        if (!validMime(bytes, media.mime_type))
          throw new Error("mime_mismatch");
        const checksum = hash(bytes);
        if (media.checksum && checksum !== media.checksum)
          throw new Error("source_checksum_changed");
        if (!db) {
          report.skipped++;
          return;
        }
        const store = db.storage.from(media.bucket);
        const object = await retry(async () => {
          let result = await store.download(media.object_path);
          if (result.error) {
            const uploaded = await store.upload(media.object_path, bytes, {
              contentType: media.mime_type,
              upsert: false,
            });
            if (
              uploaded.error &&
              !/already exists|duplicate/i.test(uploaded.error.message)
            )
              throw new Error("upload_failed");
            result = await store.download(media.object_path);
          }
          if (result.error || !result.data)
            throw new Error("object_not_verified");
          const remote = Buffer.from(await result.data.arrayBuffer());
          if (remote.length !== bytes.length || hash(remote) !== checksum)
            throw new Error("remote_checksum_mismatch");
          return true;
        });
        if (object) {
          const updated = await db
            .from(media.table)
            .update({ status: "ready", checksum })
            .eq("id", media.id);
          if (updated.error) throw new Error("metadata_update_failed");
          report.verified++;
          report.objects.push({
            legacy_id: media.legacy_id,
            variant: media.variant || "primary",
            verified: true,
          });
        }
      } catch (error) {
        report.failed.push({
          legacy_id: media.legacy_id,
          reason: [
            "unsafe_path",
            "source_checksum_changed",
            "mime_mismatch",
            "upload_failed",
            "object_not_verified",
            "remote_checksum_mismatch",
            "metadata_update_failed",
          ].includes(error.message)
            ? error.message
            : "operation_failed",
        });
      }
    }),
  );
  if (offset % (concurrency * 25) === 0) {
    await mkdir("artifacts", { recursive: true });
    await writeFile("artifacts/media-progress.json", JSON.stringify({ ...report, next_offset: offsetStart + Math.min(offset + concurrency, objects.length) }, null, 2));
    console.log(
      JSON.stringify({
        processed: Math.min(offset + concurrency, objects.length),
        verified: report.verified,
        failed: report.failed.length,
      }),
    );
  }
}
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/media-verification.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    mode: report.mode,
    planned: report.planned,
    verified: report.verified,
    failed: report.failed.length,
  }),
);
if (report.failed.length) process.exitCode = 1;
