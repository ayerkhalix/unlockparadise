import { readFile, writeFile, realpath, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { setPriority } from "node:os";
import { mediaContext } from "./context.mjs";
import { imageDerivatives, checksum } from "../../src/lib/storage/derivatives";
async function main() {
  sharp.concurrency(1);
  sharp.cache({ memory: 128, files: 20, items: 100 });
  setPriority(0, 10);
  const apply = process.argv.includes("--apply");
  const limit = Number(
    process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || 3437,
  );
  if (!Number.isInteger(limit) || limit < 1 || limit > 4000)
    throw Error("Invalid limit");
  const { db, storage } = await mediaContext();
  const concurrency = Number(
    process.argv.find((a) => a.startsWith("--concurrency="))?.split("=")[1] ||
      2,
  );
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8)
    throw Error("Use 1 to 8 workers");
  const root = "artifacts/performance-optimization";
  await mkdir(root, { recursive: true });
  const reportPath = `${root}/backfill.json`;
  const report: {
    done: Record<
      string,
      { files: number; sourceBytes: number; displayBytes: number }
    >;
    failed: Record<string, string>;
    sourceFallbacks?: Record<string, string>;
  } = await readFile(reportPath, "utf8")
    .then(JSON.parse)
    .catch(() => ({ done: {}, failed: {} }));
  try {
    const sourceRoot = await realpath("reference/wp-content/uploads");
    const media =
      await db`select m.* from public.media m where m.status='ready' and m.bucket in ('destination-public','destination-private') and m.mime_type in ('image/jpeg','image/png','image/webp') and m.metadata->>'recipe' is distinct from 'webp-v1' order by exists(select 1 from public.place_media p where p.media_id=m.id and p.kind='cover') desc,m.id`;
    const originals =
      await db`select media_id,bucket,original_path,object_path,mime_type,checksum from public.media_files where bucket='media-archive' and status='ready' and mime_type in ('image/jpeg','image/png','image/webp')`;
    const masters = new Map(originals.map((row) => [row.media_id, row]));
    let checkpoint = Promise.resolve();
    const save = () => {
      checkpoint = checkpoint.then(async () => {
        await writeFile(reportPath + ".tmp", JSON.stringify(report));
        await rename(reportPath + ".tmp", reportPath);
      });
      return checkpoint;
    };
    let index = 0,
      processed = 0;
    async function work() {
      while (index < media.length && processed < limit) {
        const m = media[index++];
        if (report.done[m.id]) continue;
        processed++;
        try {
          const source = masters.get(m.id) || m;
          let bytes: Buffer;
          try {
            const file = await realpath(
              path.resolve(sourceRoot, source.original_path || ""),
            );
            if (!file.startsWith(sourceRoot + path.sep))
              throw Error("Invalid path");
            bytes = await readFile(file);
          } catch {
            const download = await storage.storage
              .from(source.bucket)
              .download(source.object_path);
            if (download.error || !download.data)
              throw Error("Source unavailable");
            bytes = Buffer.from(await download.data.arrayBuffer());
          }
          if (source.checksum && checksum(bytes) !== source.checksum)
            throw Error("Source checksum mismatch");
          let result;
          try {
            result = await imageDerivatives(bytes, source.mime_type, {
              maximum: 1920,
            });
          } catch (error) {
            if (source === m) throw error;
            // Keep an oversized archival master unchanged and use its verified display master.
            try {
              const file = await realpath(
                path.resolve(sourceRoot, m.original_path || ""),
              );
              if (!file.startsWith(sourceRoot + path.sep))
                throw Error("Invalid path");
              bytes = await readFile(file);
            } catch {
              const download = await storage.storage
                .from(m.bucket)
                .download(m.object_path);
              if (download.error || !download.data)
                throw Error("Display master unavailable");
              bytes = Buffer.from(await download.data.arrayBuffer());
            }
            if (m.checksum && checksum(bytes) !== m.checksum)
              throw Error("Display master checksum mismatch");
            result = await imageDerivatives(bytes, m.mime_type, {
              maximum: 1920,
            });
            (report.sourceFallbacks ||= {})[m.id] =
              error instanceof Error
                ? error.message
                : "Unsupported archived source";
          }
          let displayBytes = 0;
          const stored: {
            variant: string;
            object_path: string;
            mime_type: string;
            byte_size: number;
            checksum: string;
            width: number;
            height: number;
            data?: undefined;
          }[] = [];
          // Existing small JPEG variants remain usable; prioritize actual card and hero widths.
          const copies = result.files.filter(
            (f) =>
              f.width <= 1920 &&
              (f.width >= 640 || f.width === result.files.at(-1)!.width),
          );
          await Promise.all(
            copies.map(async (file) => {
              const object_path = `optimized/webp-v1/${m.id}/${file.variant}.webp`;
              displayBytes += file.byte_size;
              if (apply) {
                const upload = await storage.storage
                  .from(m.bucket)
                  .upload(object_path, file.data, {
                    contentType: file.mime_type,
                    cacheControl:
                      m.bucket === "destination-public" ? "31536000" : "60",
                    upsert: false,
                  });
                if (upload.error) {
                  const existing = await storage.storage
                    .from(m.bucket)
                    .download(object_path);
                  if (
                    existing.error ||
                    !existing.data ||
                    checksum(
                      new Uint8Array(await existing.data.arrayBuffer()),
                    ) !== file.checksum
                  )
                    throw Error("Derivative verification failed");
                }
                stored.push({ ...file, data: undefined, object_path });
              }
            }),
          );
          // One SQL statement publishes all copies atomically without three network round trips.
          if (apply)
            await db`insert into public.media_files(media_id,variant,bucket,object_path,original_path,mime_type,byte_size,checksum,status,width,height) select ${m.id},'v1_'||f.variant,${m.bucket},f.object_path,f.object_path,f.mime_type,f.byte_size,f.checksum,'ready',f.width,f.height from jsonb_to_recordset(${db.json(stored)}::jsonb) as f(variant text,object_path text,mime_type text,byte_size bigint,checksum text,width int,height int) on conflict(media_id,variant) do nothing`;
          if (apply)
            report.done[m.id] = {
              files: copies.length,
              sourceBytes: bytes.length,
              displayBytes,
            };
          delete report.failed[m.id];
          if (processed <= 4)
            await writeFile(
              `${root}/pilot-${processed}.webp`,
              result.files.find((f) => f.width >= 640)?.data ||
                result.files.at(-1)!.data,
            );
        } catch (error) {
          report.failed[m.id] =
            error instanceof Error ? error.message : "Processing failed";
        }
        await save();
        if (processed % 20 === 0)
          console.log(
            JSON.stringify({
              processed,
              done: Object.keys(report.done).length,
              failed: Object.keys(report.failed).length,
            }),
          );
      }
    }
    await Promise.all(Array.from({ length: concurrency }, work));
    console.log(
      JSON.stringify({
        processed,
        done: Object.keys(report.done).length,
        failed: Object.keys(report.failed).length,
        apply,
      }),
    );
  } finally {
    await db.end();
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Backfill failed");
  process.exitCode = 1;
});
