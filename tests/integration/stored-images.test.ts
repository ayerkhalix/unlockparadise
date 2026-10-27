import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { storedImage, type StoredImage } from "../../src/lib/storage/variants";
import { imageDerivatives, checksum } from "../../src/lib/storage/derivatives";
import { responsiveImage } from "../../src/lib/image-delivery";

test("stored delivery selects adequate existing files and never crosses visibility or serves archives", () => {
  const parent: StoredImage = {
    bucket: "destination-private",
    object_path: "base.jpg",
    mime_type: "image/jpeg",
    status: "ready",
    width: 2048,
  };
  const f = (
    width: number,
    bucket = parent.bucket,
    mime_type = "image/jpeg",
  ): StoredImage => ({
    ...parent,
    bucket,
    mime_type,
    width,
    object_path: `${width}.${mime_type.split("/")[1]}`,
  });
  const files = [
    f(384),
    f(768),
    f(768, parent.bucket, "image/webp"),
    f(1080, "destination-public"),
    f(640, "media-archive"),
  ];
  assert.equal(storedImage(parent, files, 640).object_path, "768.webp");
  assert.equal(storedImage(parent, files, 1920).object_path, "base.jpg");
  assert.equal(storedImage(parent, files, 5000).object_path, "base.jpg");
  assert.equal(
    storedImage(parent, [{ ...f(640), status: "pending" }], 640).object_path,
    "base.jpg",
  );
  assert.equal(
    storedImage(
      parent,
      [{ ...f(256), variant: "thumbnail" }],
      undefined,
      "thumbnail",
    ).width,
    256,
  );
  const src = "/api/media/00000000-0000-4000-8000-000000000001/";
  assert.ok(!responsiveImage(src, 768).srcSet?.includes("1920w"));
});

test("upload processing preserves source bytes, orientation and transparency while producing bounded deterministic files", async () => {
  const input = await sharp({
    create: { width: 1500, height: 900, channels: 3, background: "#357488" },
  })
    .withMetadata({ orientation: 6 })
    .jpeg({ quality: 95 })
    .toBuffer();
  const before = checksum(input);
  const result = await imageDerivatives(input, "image/jpeg");
  assert.equal(checksum(input), before);
  assert.equal(result.sourceChecksum, before);
  assert.equal(result.width, 900);
  assert.equal(result.height, 1500);
  assert.deepEqual(
    result.files.map((f) => f.width),
    [256, 384, 640, 900],
  );
  for (const file of result.files) {
    const meta = await sharp(file.data).metadata();
    assert.equal(meta.format, "webp");
    assert.equal(meta.orientation, undefined);
    assert.equal(meta.exif, undefined);
    assert.equal(meta.width, file.width);
  }
  const png = await sharp({
    create: {
      width: 80,
      height: 50,
      channels: 4,
      background: { r: 240, g: 20, b: 80, alpha: 0.35 },
    },
  })
    .png()
    .toBuffer();
  const transparent = await imageDerivatives(png, "image/png");
  assert.equal(transparent.files[0].width, 80);
  assert.equal(
    (await sharp(transparent.files[0].data).metadata()).hasAlpha,
    true,
  );
  assert.deepEqual(
    await sharp(png).raw().toBuffer(),
    await sharp(transparent.files[0].data).raw().toBuffer(),
  );
  await assert.rejects(() => imageDerivatives(input, "image/png"));
  await assert.rejects(() =>
    imageDerivatives(Buffer.from("not an image"), "image/jpeg"),
  );
});
