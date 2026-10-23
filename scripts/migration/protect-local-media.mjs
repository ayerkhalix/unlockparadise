// Move only generated public copies. WordPress source references stay read-only.
import { readFile, writeFile, mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";
const root = process.cwd(),
  apply = process.argv.includes("--apply");
const source = JSON.parse(
  await readFile("artifacts/backend-private/content-manifest.json", "utf8"),
);
const publicPaths = new Set(),
  privatePaths = new Map();
const vipPlaces = new Set(
  source.places.filter((p) => p.vip_content).map((p) => p.id),
);
for (const media of source.media) {
  const entries = [
    { original_path: media.original_path, variant: "primary" },
    ...(source.media_files || []).filter((v) => v.media_id === media.id),
  ];
  for (const entry of entries) {
    const original = entry.original_path;
    if (!original || original.includes("..") || path.isAbsolute(original))
      continue;
    const url = "/original/wp-content/uploads/" + original;
    if (media.bucket === "destination-public" && entry.variant !== "original")
      publicPaths.add(url);
    else {
      const links = source.place_media.filter((m) => m.media_id === media.id);
      const required_tier =
        entry.variant === "original" || !links.length
          ? "private"
          : links.some((m) => !vipPlaces.has(m.place_id))
            ? "explorer"
            : "explorer-plus";
      privatePaths.set(url, {
        id: media.id,
        legacy_id: media.legacy_id,
        variant: entry.variant || "primary",
        mime_type: entry.mime_type || media.mime_type,
        relative: original,
        required_tier,
      });
    }
  }
}
for (const url of publicPaths) privatePaths.delete(url);
let moved = 0,
  restored = 0;
// Classification changes may make an earlier quarantined copy public again.
for (const url of publicPaths) {
  const relative = url.slice("/original/wp-content/uploads/".length);
  const target = path.resolve(root, "public", url.slice(1)),
    saved = path.resolve(
      root,
      "artifacts/backend-private/local-media",
      relative,
    );
  if (
    !target.startsWith(path.resolve(root, "public") + path.sep) ||
    !saved.startsWith(
      path.resolve(root, "artifacts/backend-private/local-media") + path.sep,
    )
  )
    throw new Error("Unsafe generated-copy restoration");
  const available = await stat(saved)
      .then((s) => s.isFile())
      .catch(() => false),
    exists = await stat(target)
      .then((s) => s.isFile())
      .catch(() => false);
  if (apply && available && !exists) {
    await mkdir(path.dirname(target), { recursive: true });
    await rename(saved, target);
    restored++;
  }
}
const routing = {};
for (const [url, record] of privatePaths) {
  const from = path.resolve(root, "public", url.slice(1));
  const to = path.resolve(
    root,
    "artifacts/backend-private/local-media",
    record.relative,
  );
  if (
    !from.startsWith(path.resolve(root, "public") + path.sep) ||
    !to.startsWith(
      path.resolve(root, "artifacts/backend-private/local-media") + path.sep,
    )
  )
    throw new Error("Unsafe generated-copy move");
  const exists = await stat(from)
    .then((s) => s.isFile())
    .catch(() => false);
  const saved = await stat(to)
    .then((s) => s.isFile())
    .catch(() => false);
  if (!exists && !saved) continue;
  routing[url] = record;
  if (apply && exists) {
    await mkdir(path.dirname(to), { recursive: true });
    await rename(from, to);
    moved++;
  }
}
if (apply) {
  await mkdir("src/lib/generated", { recursive: true });
  await writeFile(
    "src/lib/generated/media-routing.json",
    JSON.stringify(routing),
  );
}
console.log(
  JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    protected_paths: Object.keys(routing).length,
    moved_copies: moved,
    restored_public_copies: restored,
    wordpress_source_modified: false,
  }),
);
