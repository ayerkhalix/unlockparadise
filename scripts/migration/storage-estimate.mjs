import { readFile, writeFile } from "node:fs/promises";
const manifest = JSON.parse(await readFile("artifacts/backend-private/content-manifest.json", "utf8"));
const files = [...manifest.media, ...manifest.media_files], unique = new Map();
for (const f of files) {
  if (!f.checksum) throw new Error("Missing validated checksum");
  const existing = unique.get(f.checksum);
  if (existing && existing.byte_size !== f.byte_size) throw new Error("Checksum size conflict");
  unique.set(f.checksum, f);
}
const bytes = files.reduce((n, f) => n + f.byte_size, 0);
const uniqueBytes = [...unique.values()].reduce((n, f) => n + f.byte_size, 0);
const report = { source_files: files.length, attachment_records: manifest.media.length, generated_sizes_and_originals: manifest.media_files.length, total_bytes: bytes, total_gib: bytes / 1024 ** 3, unique_sha256_objects: unique.size, verified_unique_bytes: uniqueBytes, unique_gib: uniqueBytes / 1024 ** 3, duplicate_bytes: bytes - uniqueBytes, buckets: {}, free_included_bytes: 1e9, pro_included_bytes: 100e9, pro_covers_current_layout: bytes <= 100e9, uploads_executed: 0 };
for (const f of files) { report.buckets[f.bucket] ??= { files: 0, bytes: 0 }; report.buckets[f.bucket].files++; report.buckets[f.bucket].bytes += f.byte_size; }
await writeFile("artifacts/storage-estimate.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
