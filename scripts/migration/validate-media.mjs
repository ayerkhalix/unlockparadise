import { readFile, open, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileMime, validMime } from "./file-validation.mjs";
const manifest = JSON.parse(
  await readFile("artifacts/backend-private/content-manifest.json", "utf8"),
);
const files = [...manifest.media, ...manifest.media_files];
const root = path.resolve(
  process.env.WORDPRESS_UPLOADS || "reference/wp-content/uploads",
);
const report = { checked: 0, mime_counts: {}, failures: [] };
for (let offset = 0; offset < files.length; offset += 16)
  await Promise.all(
    files.slice(offset, offset + 16).map(async (item) => {
      let file;
      try {
        const target = path.resolve(root, item.original_path);
        if (!target.startsWith(root + path.sep)) throw new Error("unsafe_path");
        file = await open(target, "r");
        const header = Buffer.alloc(4096);
        const read = await file.read(header, 0, header.length, 0);
        const bytes = header.subarray(0, read.bytesRead);
        const actual = fileMime(bytes);
        if (!validMime(bytes, item.mime_type)) throw new Error("mime_mismatch");
        report.mime_counts[actual] = (report.mime_counts[actual] || 0) + 1;
        report.checked++;
      } catch (error) {
        report.failures.push({
          source_id: item.legacy_id || item.media_id,
          variant: item.variant || "primary",
          reason:
            error.message === "mime_mismatch"
              ? "mime_mismatch"
              : "file_unavailable",
        });
      } finally {
        await file?.close();
      }
    }),
  );
await writeFile(
  "artifacts/media-format-validation.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    checked: report.checked,
    mime_counts: report.mime_counts,
    failures: report.failures.length,
  }),
);
if (report.failures.length) process.exitCode = 1;
