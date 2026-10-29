import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

// Public editorial assets only. Uploaded/private media keeps its authenticated route.
const fragments = JSON.parse(await readFile("src/data/fragments.json", "utf8"));
const map = JSON.parse(await readFile("src/data/map.json", "utf8"));
const hero = fragments.hero.match(
  /class="upd-hero-bg"[^>]*url\(['"]?([^)'"\s]+)/,
)?.[1];
if (!hero) throw Error("Homepage hero source is missing");
const sources = [...new Set([hero, ...map.categories.map((c) => c.image)])];
const output = "public/site/optimized";
await mkdir(output, { recursive: true });
const manifest = {};
let bytes = 0;
for (const source of sources) {
  if (!source.startsWith("/original/") || source.includes(".."))
    throw Error("Only local public editorial assets may be prepared");
  const input = await readFile(`public${source}`);
  const meta = await sharp(input).metadata();
  const { width, height } = meta.autoOrient;
  const widths = [
    ...new Set([256, 384, 640, 1080, 1920, width].filter((w) => w <= width)),
  ].sort((a, b) => a - b);
  const key = createHash("sha256")
    .update(input)
    .update("site-webp88-srgb-v1")
    .digest("hex")
    .slice(0, 16);
  const files = {};
  for (const size of widths) {
    let data = await sharp(input)
      .rotate()
      .withIccProfile("srgb")
      .resize({ width: size, withoutEnlargement: true })
      .webp({ quality: 88, effort: 5 })
      .toBuffer();
    let extension = "webp";
    // Keep the exact JPEG at native size when it is already the smaller option.
    if (
      size === width &&
      meta.format === "jpeg" &&
      (meta.orientation || 1) === 1 &&
      input.length <= data.length
    ) {
      data = input;
      extension = "jpg";
    }
    const name = `${key}-${size}.${extension}`;
    await writeFile(`${output}/${name}`, data);
    files[size] = `/site/optimized/${name}`;
    bytes += data.length;
  }
  manifest[source] = { width, height, files };
}
await writeFile(
  "src/data/site-images.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(JSON.stringify({ sources: sources.length, bytes }));
