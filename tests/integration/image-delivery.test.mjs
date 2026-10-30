import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import {
  imageDeliveryUrl,
  responsiveImage,
} from "../../src/lib/image-delivery.ts";
test("image delivery keeps private images on the authenticated route and leaves unknown sources intact", () => {
  const media =
    "/api/media/10000000-0000-4000-8000-000000000581/?variant=medium_large";
  const response = responsiveImage(media);
  assert.ok(response.src.startsWith("/api/media/"));
  assert.ok(response.src.includes("variant=medium_large&width=640"));
  assert.ok(response.src.includes("resize=contain"));
  assert.ok(!response.srcSet.includes("/_next/image"));
  const preview = responsiveImage(
    "/api/previews/10000000-0000-4000-8000-000000000581/?v=cover-version",
  );
  assert.ok(preview.srcSet.includes("1920w"));
  assert.ok(preview.srcSet.includes("width=384"));
  assert.ok(preview.src.startsWith("/api/previews/"));
  assert.ok(preview.src.includes("v=cover-version"));
  assert.ok(!preview.srcSet.includes("storage/v1"));
  assert.equal(imageDeliveryUrl(media, 99999), media);
  for (const src of [
    "/api/previews/secret/",
    "https://untrusted.example/private.jpg",
    "data:image/png;base64,xx",
    "/original/logo.svg",
  ])
    assert.deepEqual(responsiveImage(src), { src });
  assert.ok(
    imageDeliveryUrl("/original/photo.jpg", 640).startsWith("/_next/image?"),
  );
});

test("prepared public editorial images advertise actual raster widths and retain the native hero bytes", async () => {
  const manifest = JSON.parse(
    await readFile("src/data/site-images.json", "utf8"),
  );
  for (const [source, image] of Object.entries(manifest)) {
    const delivery = responsiveImage(source);
    for (const [width, path] of Object.entries(image.files)) {
      assert.ok(delivery.srcSet.includes(`${path} ${width}w`));
      const meta = await sharp(`public${path}`).metadata();
      assert.equal(meta.width, Number(width));
      assert.ok(meta.width <= image.width);
    }
  }
  const [source, image] = Object.entries(manifest).find(
    ([, image]) => image.width === 2560,
  );
  assert.ok(responsiveImage(source).srcSet.includes("2560w"));
  assert.deepEqual(
    await readFile(`public${image.files[2560]}`),
    await readFile(`public${source}`),
  );
});
